import os
import sys
import time
from urllib.parse import urlencode

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service


MAX_ATTEMPTS = 3


def _create_driver(download_dir: str, headless: bool):
    """
    Cria um Chrome novo para cada tentativa.
    Isso é importante: uma tentativa problemática não deixa
    estado do navegador contaminando a próxima.
    """

    chrome_options = Options()

    prefs = {
        "download.default_directory": os.path.abspath(
            download_dir
        ),
        "download.prompt_for_download": False,
        "download.directory_upgrade": True,
        "safebrowsing.enabled": True,
    }

    chrome_options.add_experimental_option(
        "prefs",
        prefs
    )

    if headless:
        print("[Enchor] Modo headless ativado.")

        chrome_options.add_argument(
            "--headless=new"
        )

        chrome_options.add_argument(
            "--window-size=1920,1080"
        )

        chrome_options.add_argument(
            "--disable-gpu"
        )

        chrome_options.add_argument(
            "--no-sandbox"
        )

        chrome_options.add_argument(
            "--disable-dev-shm-usage"
        )

    # Algumas instalações do Chrome/Selenium ficam mais
    # estáveis com essas opções.
    chrome_options.add_argument(
        "--disable-notifications"
    )

    chrome_options.add_argument(
        "--disable-popup-blocking"
    )

    chrome_options.add_argument(
        "--disable-blink-features=AutomationControlled"
    )

    chrome_binary = os.getenv("CHROME_BINARY")
    if not chrome_binary:
        for candidate in ("/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome"):
            if os.path.exists(candidate):
                chrome_binary = candidate
                break

    if chrome_binary:
        chrome_options.binary_location = chrome_binary

    chromedriver_path = os.getenv("CHROMEDRIVER_PATH")
    service = Service(chromedriver_path) if chromedriver_path else None

    driver = webdriver.Chrome(
        service=service,
        options=chrome_options
    )

    driver.set_window_size(
        1920,
        1080
    )

    return driver


def _get_existing_zip_files(download_dir: str):
    """
    Retorna os ZIPs já existentes antes da tentativa.
    """
    return {
        os.path.abspath(
            os.path.join(download_dir, filename)
        )
        for filename in os.listdir(download_dir)
        if filename.lower().endswith(".zip")
    }


def _wait_for_new_zip(
    download_dir: str,
    previous_files: set[str],
    timeout: int = 60
):
    """
    Espera um ZIP novo terminar de baixar.

    Não basta encontrar um .zip: precisamos garantir que:
      - seja novo
      - não exista .crdownload/.part correspondente
      - o tamanho permaneça estável
    """

    deadline = time.time() + timeout

    last_size = None
    stable_since = None

    while time.time() < deadline:

        current_files = []

        for filename in os.listdir(download_dir):

            lower = filename.lower()

            if lower.endswith(".zip"):
                current_files.append(
                    os.path.abspath(
                        os.path.join(
                            download_dir,
                            filename
                        )
                    )
                )

        new_files = [
            path
            for path in current_files
            if path not in previous_files
        ]

        # Também verificamos downloads temporários.
        temporary_downloads = [
            filename
            for filename in os.listdir(download_dir)
            if filename.lower().endswith(
                (".crdownload", ".part", ".tmp")
            )
        ]

        if new_files and not temporary_downloads:

            # Pega o arquivo ZIP mais recente.
            latest = max(
                new_files,
                key=lambda path: os.path.getmtime(path)
            )

            try:
                size = os.path.getsize(latest)
            except OSError:
                time.sleep(0.5)
                continue

            if (
                last_size == size
                and size > 0
            ):
                if stable_since is None:
                    stable_since = time.time()

                # Tamanho permaneceu estável por 1 segundo.
                if time.time() - stable_since >= 1.0:
                    return latest

            else:
                last_size = size
                stable_since = time.time()

        time.sleep(0.5)

    return None


def _get_result_count(driver):
    """
    Extrai o número de resultados mostrado pelo Enchor.

    IMPORTANTE:
    Não usa mais 'if "0" in text', pois isso quebrava
    resultados como 10, 20, 30 etc.
    """

    spans = driver.find_elements(
        By.CSS_SELECTOR,
        "span.text-lg"
    )

    for span in spans:

        text = span.text.strip()

        if not text:
            continue

        # Exemplo esperado:
        # "12 charts"
        # "1 result"
        #
        # Procuramos o primeiro número inteiro.
        import re

        match = re.search(
            r"\d+",
            text
        )

        if match:

            try:
                count = int(
                    match.group(0)
                )

                return count, text

            except ValueError:
                pass

    return None, ""


def download_chart_from_enchor(
    song_name: str,
    artist_name: str = "",
    difficulty: str = "expert",
    download_dir: str = "downloads",
    headless: bool = False,
):
    """
    Busca uma música no Enchor, clica no primeiro resultado,
    escolhe .zip e baixa.

    Realiza até 3 tentativas completas caso alguma etapa falhe.
    """

    os.makedirs(
        download_dir,
        exist_ok=True
    )

    # ------------------------------------------------------------
    # URL
    # ------------------------------------------------------------

    params = {
        "instrument": "guitar",
        "difficulty": difficulty,
        "name": song_name,
    }

    if artist_name:
        params["artist"] = artist_name

    search_url = (
        "https://www.enchor.us/?"
        + urlencode(params)
    )

    print(
        f"[Enchor] URL de busca: {search_url}"
    )

    # ------------------------------------------------------------
    # TENTATIVAS
    # ------------------------------------------------------------

    for attempt in range(
        1,
        MAX_ATTEMPTS + 1
    ):

        driver = None

        print()
        print("=" * 60)
        print(
            f"[Enchor] TENTATIVA "
            f"{attempt}/{MAX_ATTEMPTS}"
        )
        print("=" * 60)

        try:

            # ----------------------------------------------------
            # Driver novo
            # ----------------------------------------------------

            driver = _create_driver(
                download_dir=download_dir,
                headless=headless,
            )

            # Arquivos existentes ANTES desta tentativa.
            previous_zip_files = (
                _get_existing_zip_files(
                    download_dir
                )
            )

            # ----------------------------------------------------
            # Abrir Enchor
            # ----------------------------------------------------

            print(
                "[Enchor] Abrindo página..."
            )

            driver.get(
                search_url
            )

            wait = WebDriverWait(
                driver,
                45 if headless else 30
            )

            # ------------------------------------------------------------
            # RESULTADOS
            # ------------------------------------------------------------

            print("[Enchor] Aguardando resultados...")

            wait = WebDriverWait(
                driver,
                60 if headless else 45
            )


            def resultados_maior_que_zero(driver):
                """
                Verifica se o Enchor exibiu pelo menos 1 resultado.

                Não usa:
                    if "0" in text

                porque isso quebraria:
                    10 resultados
                    20 resultados
                    30 resultados
                """

                try:
                    spans = driver.find_elements(
                        By.CSS_SELECTOR,
                        "span.text-lg"
                    )

                    for span in spans:

                        text = span.text.strip()

                        if not text:
                            continue

                        import re

                        match = re.search(
                            r"\d+",
                            text
                        )

                        if not match:
                            continue

                        count = int(
                            match.group(0)
                        )

                        if count > 0:
                            return True

                    return False

                except Exception:
                    return False


            wait.until(
                resultados_maior_que_zero
            )


            # ------------------------------------------------------------
            # RESULTADO ENCONTRADO
            # ------------------------------------------------------------

            count = None
            result_text = ""

            spans = driver.find_elements(
                By.CSS_SELECTOR,
                "span.text-lg"
            )

            for span in spans:

                text = span.text.strip()

                if not text:
                    continue

                import re

                match = re.search(
                    r"\d+",
                    text
                )

                if match:

                    count = int(
                        match.group(0)
                    )

                    result_text = text

                    break


            print(
                f"[Enchor] Resultados encontrados: "
                f"{result_text or count or 'desconhecido'}"
            )


            # Dá um pequeno tempo para o conteúdo dos resultados
            # terminar de renderizar antes do botão ser clicado.
            time.sleep(1.5)


            # ------------------------------------------------------------
            # BOTÃO DOWNLOAD
            # ------------------------------------------------------------

            print(
                "[Enchor] Aguardando botão de download..."
            )

            download_button = wait.until(
                EC.element_to_be_clickable(
                    (
                        By.CSS_SELECTOR,
                        "button.btn.btn-primary.join-item.px-4"
                    )
                )
            )

            print(
                "[Enchor] Botão de download encontrado."
            )


            driver.execute_script(
                "arguments[0].scrollIntoView({block: 'center'});",
                download_button
            )

            time.sleep(0.8)


            try:

                download_button.click()

            except Exception:

                driver.execute_script(
                    "arguments[0].click();",
                    download_button
                )


            print(
                "[Enchor] Modal de download aberto."
            )

            # ----------------------------------------------------
            # SELECIONAR ZIP
            # ----------------------------------------------------

            radio_zip = wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        "//label[contains(., '.zip')]"
                        "/input[@type='radio']"
                    )
                )
            )

            try:
                radio_zip.click()
            except Exception:
                driver.execute_script(
                    "arguments[0].click();",
                    radio_zip
                )

            print(
                "[Enchor] Formato .zip selecionado."
            )

            # ----------------------------------------------------
            # DOWNLOAD
            # ----------------------------------------------------

            download_modal_btn = wait.until(
                EC.element_to_be_clickable(
                    (
                        By.CSS_SELECTOR,
                        "div.modal-box button.btn.btn-primary"
                    )
                )
            )

            try:
                download_modal_btn.click()
            except Exception:
                driver.execute_script(
                    "arguments[0].click();",
                    download_modal_btn
                )

            print(
                "[Enchor] Download iniciado."
            )

            # ----------------------------------------------------
            # ESPERAR ZIP REAL
            # ----------------------------------------------------

            print(
                "[Enchor] Aguardando download..."
            )

            filepath = _wait_for_new_zip(
                download_dir=download_dir,
                previous_files=previous_zip_files,
                timeout=60,
            )

            if filepath:

                print(
                    "[Enchor] "
                    f"Download concluído: {filepath}"
                )

                return filepath

            raise RuntimeError(
                "O download foi iniciado, mas "
                "nenhum novo .zip foi finalizado."
            )

        except Exception as e:

            print()
            print(
                f"[Enchor] Falha na tentativa "
                f"{attempt}/{MAX_ATTEMPTS}: {e}"
            )

            # Debug resumido.
            if driver:

                try:
                    print(
                        "[Enchor] URL atual:"
                    )

                    print(
                        driver.current_url
                    )

                    print(
                        "[Enchor] Título atual:"
                    )

                    print(
                        driver.title
                    )

                except Exception:
                    pass

            if attempt < MAX_ATTEMPTS:

                print(
                    "[Enchor] "
                    "Reiniciando tentativa..."
                )

                # Dá um pequeno intervalo antes de
                # abrir o navegador novamente.
                time.sleep(2)

            else:

                print(
                    "[Enchor] "
                    "Todas as tentativas falharam."
                )

        finally:

            if driver:

                try:
                    driver.quit()
                except Exception:
                    pass

    return None


if __name__ == "__main__":

    if len(sys.argv) < 2:

        print(
            "Uso: python test_enchor.py "
            '"Nome da Música" '
            '["Nome do Artista"] '
            "[dificuldade] "
            "[--headless]"
        )

        print(
            "Dificuldade: "
            "easy, medium, hard, expert "
            "(padrão: expert)"
        )

        print(
            "--headless: "
            "ativa o modo headless"
        )

        print(
            'Exemplo: '
            'python test_enchor.py '
            '"Holy Diver" "Dio" expert'
        )

        print(
            'Exemplo headless: '
            'python test_enchor.py '
            '"Holy Diver" "Dio" expert --headless'
        )

        sys.exit(1)

    musica = sys.argv[1]

    artista = (
        sys.argv[2]
        if (
            len(sys.argv) > 2
            and not sys.argv[2].startswith("--")
        )
        else ""
    )

    dificuldade = "expert"
    headless = False

    for arg in sys.argv[2:]:

        if arg in [
            "easy",
            "medium",
            "hard",
            "expert",
        ]:
            dificuldade = arg

        elif arg == "--headless":
            headless = True

    print(
        "=" * 60
    )

    print(
        "🎸 TESTE DE DOWNLOAD DO ENCHOR"
    )

    print(
        "=" * 60
    )

    print(
        f"Música: {musica}"
    )

    print(
        f"Artista: {artista or '(não informado)'}"
    )

    print(
        f"Dificuldade: {dificuldade}"
    )

    print(
        f"Headless: {headless}"
    )

    print(
        f"Tentativas máximas: {MAX_ATTEMPTS}"
    )

    print(
        "=" * 60
    )

    resultado = (
        download_chart_from_enchor(
            musica,
            artista,
            dificuldade,
            download_dir="./downloads_test",
            headless=headless,
        )
    )

    if resultado:

        print(
            "\n✅ SUCESSO!"
        )

        print(
            f"Arquivo baixado em: {resultado}"
        )

    else:

        print(
            "\n❌ FALHA!"
        )

        print(
            "Não foi possível baixar a chart "
            "após todas as tentativas."
        )