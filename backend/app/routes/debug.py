from urllib.parse import urlparse
import time

from fastapi import APIRouter, HTTPException, Query
from selenium import webdriver
from selenium.webdriver.chrome.options import Options


router = APIRouter(
    prefix="/api/debug",
    tags=["debug"],
)


DEFAULT_URL = "https://www.youtube.com/watch?v=PeMvMNpvB5M"


def _validate_youtube_url(url: str) -> str:
    parsed = urlparse(url.strip())

    host = parsed.netloc.lower().split(":", 1)[0]

    allowed_hosts = {
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "music.youtube.com",
        "youtu.be",
        "www.youtu.be",
    }

    if parsed.scheme not in {"http", "https"} or host not in allowed_hosts:
        raise HTTPException(
            status_code=400,
            detail="Informe uma URL válida do YouTube.",
        )

    return url.strip()


def _build_driver():
    options = Options()

    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--lang=pt-BR")

    options.add_argument(
        "--user-agent="
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/151.0.0.0 Safari/537.36"
    )

    return webdriver.Chrome(options=options)


@router.get("/youtube")
def debug_youtube(
    url: str = Query(default=DEFAULT_URL)
):
    """
    Diagnóstico temporário.

    Abre um vídeo do YouTube utilizando Chromium + Selenium,
    sem utilizar yt-dlp.

    Objetivo:
    descobrir se o YouTube pode ser acessado pelo navegador
    dentro do ambiente do Render.
    """

    youtube_url = _validate_youtube_url(url)

    driver = None
    started_at = time.time()

    try:
        print("[YouTube Debug] Iniciando Chromium...")

        driver = _build_driver()

        driver.set_page_load_timeout(30)

        print(f"[YouTube Debug] Abrindo: {youtube_url}")

        driver.get(youtube_url)

        # Dá alguns segundos para o JS/player carregar.
        time.sleep(5)

        current_url = driver.current_url
        browser_title = driver.title
        page_source = driver.page_source

        def execute_js(script: str):
            try:
                return driver.execute_script(script)
            except Exception as exc:
                print(
                    f"[YouTube Debug] Erro JS: {exc}"
                )
                return None

        og_title = execute_js(
            """
            const el = document.querySelector(
                'meta[property="og:title"]'
            );
            return el ? el.content : null;
            """
        )

        thumbnail = execute_js(
            """
            const el = document.querySelector(
                'meta[property="og:image"]'
            );
            return el ? el.content : null;
            """
        )

        description = execute_js(
            """
            const el = document.querySelector(
                'meta[property="og:description"]'
            );
            return el ? el.content : null;
            """
        )

        channel = execute_js(
            """
            const selectors = [
                'ytd-channel-name a',
                '#owner #channel-name a',
                'yt-formatted-string.ytd-channel-name'
            ];

            for (const selector of selectors) {
                const el = document.querySelector(selector);

                if (
                    el &&
                    el.textContent &&
                    el.textContent.trim()
                ) {
                    return el.textContent.trim();
                }
            }

            return null;
            """
        )

        duration = execute_js(
            """
            try {
                const video = document.querySelector('video');

                if (
                    video &&
                    Number.isFinite(video.duration) &&
                    video.duration > 0
                ) {
                    return Math.floor(video.duration);
                }
            } catch (e) {
            }

            return null;
            """
        )

        player_response_keys = execute_js(
            """
            const response =
                window.ytInitialPlayerResponse;

            if (
                response &&
                typeof response === 'object'
            ) {
                return Object.keys(response);
            }

            return [];
            """
        )

        result = {
            "success": True,
            "test_url": youtube_url,
            "current_url": current_url,
            "browser_title": browser_title,
            "og_title": og_title,
            "channel": channel,
            "thumbnail": thumbnail,
            "description_found": bool(description),
            "duration_seconds": duration,
            "page_source_length": len(page_source),
            "player_response_keys": player_response_keys or [],
            "elapsed_seconds": round(
                time.time() - started_at,
                2,
            ),
        }

        print(
            "[YouTube Debug] Resultado:",
            result,
        )

        return result

    except Exception as exc:
        print(
            "[YouTube Debug] ERRO:",
            repr(exc),
        )

        raise HTTPException(
            status_code=500,
            detail={
                "success": False,
                "error_type": type(exc).__name__,
                "error": str(exc),
                "elapsed_seconds": round(
                    time.time() - started_at,
                    2,
                ),
            },
        ) from exc

    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass