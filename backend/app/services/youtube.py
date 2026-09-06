import yt_dlp


BGUTIL_SERVER_HOME = "/opt/bgutil-ytdlp-pot-provider/server"


def get_video_metadata(url: str) -> dict:
    """
    Extrai metadados públicos do YouTube usando o próprio yt-dlp.

    Importante: esta etapa usa exatamente o mesmo stack moderno usado
    no download: EJS + Deno + bgutil PO Token + client mweb.
    """
    options = {
        "quiet": True,
        "no_warnings": False,
        "skip_download": True,
        "noplaylist": True,
        "force_ipv4": True,

        # Resolver os desafios JS atuais do YouTube.
        "remote_components": ["ejs:github"],
        "js_runtimes": {
            "deno": {}
        },

        # PO Token via bgutil.
        "extractor_args": {
            "youtube": {
                "player_client": ["mweb"]
            },
            "youtubepot-bgutilscript": {
                "server_home": BGUTIL_SERVER_HOME
            }
        },

        "retries": 3,
        "nocheckcertificate": True,

        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Linux; Android 14; Pixel 7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/151.0.0.0 Mobile Safari/537.36"
            ),
            "Accept-Language": (
                "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
            ),
        },
    }

    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(url, download=False)

    return {
        "title": info.get("title"),
        "artist": (
            info.get("artist")
            or info.get("creator")
            or info.get("uploader")
        ),
        "thumbnail": info.get("thumbnail"),
        "duration": info.get("duration"),
        "source_url": url,
    }
