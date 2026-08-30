import React, { useEffect, useRef, useState, useMemo } from "react";
import logoImg from "../assets/logo.png";
import { useSettings } from "../contexts/SettingsContext";
import { useAuth } from "../contexts/AuthContext";
import "./Game.css";
import { getBackgroundSettings, getBackgroundAsset } from "../services/backgroundStorage";

import API_URL from "../config";

const LANES = 5;
const HIT_WINDOW = 0.24;

const LANE_COLORS = [
  "#20d83b",
  "#ff2020",
  "#ffd21f",
  "#159cff",
  "#ff9418",
];

const LANE_WEIGHTS = [
  1.18,
  1.0,
  1.0,
  1.0,
  1.18,
];

const TOTAL_LANE_WEIGHT =
  LANE_WEIGHTS.reduce(
    (sum, value) => sum + value,
    0
  );

const HIT_LINE_TOP = 85;

const MIN_SUSTAIN_DURATION = 0.20;

const SUSTAIN_WIDTH_RATIO = 0.10;


/*
 * VISUAL_READABILITY_TUNING
 *
 * Somente visual.
 * Não altera timestamps da chart.
 */

const NOTE_SCALE_MIN = 0.26;
const NOTE_SCALE_RANGE = 0.74;


/*
 * PERFORMANCE
 */

const HUD_RENDER_INTERVAL = 80;

const VIDEO_SYNC_INTERVAL = 250;


/*
 * Sustain normal.
 *
 * Mantemos uma tolerância mínima de 20ms,
 * mas a regra principal agora é 80%.
 */

const SUSTAIN_RELEASE_TOLERANCE = 0.02;


/*
 * Percentual mínimo da cauda necessário
 * para considerar o sustain como ACERTO.
 *
 * 0.80 = 80%
 */

const SUSTAIN_COMPLETION_RATIO = 0.80;


/* ============================================================
   GEOMETRIA DAS LANES
============================================================ */

const LANE_GEOMETRY =
  LANE_WEIGHTS.map(
    (weight, lane) => {
      const prefix =
        LANE_WEIGHTS
          .slice(0, lane)
          .reduce(
            (sum, value) =>
              sum + value,
            0
          );

      const ratioStart =
        prefix /
        TOTAL_LANE_WEIGHT;

      const ratioEnd =
        (prefix + weight) /
        TOTAL_LANE_WEIGHT;

      return {
        topLeft:
          40 +
          20 * ratioStart,

        topRight:
          40 +
          20 * ratioEnd,

        bottomLeft:
          5 +
          90 * ratioStart,

        bottomRight:
          5 +
          90 * ratioEnd,

        topCenter:
          40 +
          20 *
            (
              (ratioStart +
                ratioEnd) *
              0.5
            ),

        bottomCenter:
          5 +
          90 *
            (
              (ratioStart +
                ratioEnd) *
              0.5
            ),
      };
    }
  );


function getLaneGeometry(
  lane,
  depth
) {
  const geometry =
    LANE_GEOMETRY[lane] ||
    LANE_GEOMETRY[0];

  return {
    left:
      geometry.topLeft +
      (
        geometry.bottomLeft -
        geometry.topLeft
      ) *
        depth,

    right:
      geometry.topRight +
      (
        geometry.bottomRight -
        geometry.topRight
      ) *
        depth,

    center:
      geometry.topCenter +
      (
        geometry.bottomCenter -
        geometry.topCenter
      ) *
        depth,
  };
}


function getNoteDurationFast(
  note
) {
  const duration =
    Number(
      note?.duration
    ) || 0;

  return duration >=
    MIN_SUSTAIN_DURATION
    ? duration
    : 0;
}


/* ============================================================
   GAME
============================================================ */

function Game({
  song,
  difficulty,
  onBack,
}) {
  const {
    settings,
  } = useSettings();

  const {
    user,
  } = useAuth();


  /* ==========================================================
     TECLAS
  ========================================================== */

  const activeKeys =
    useMemo(
      () =>
        settings.keyBindings.map(
          (key) =>
            key.toUpperCase()
        ),
      [settings.keyBindings]
    );


  /* ==========================================================
     STATE DE UI
  ========================================================== */

  const [
    isPaused,
    setIsPaused,
  ] = useState(false);

  const [
    showPauseMenu,
    setShowPauseMenu,
  ] = useState(false);

  const [
    pendingAction,
    setPendingAction,
  ] = useState(null);


  /* ==========================================================
     MEDIA
  ========================================================== */

  const videoRef =
    useRef(null);

  const audioRef =
    useRef(null);

  const [backgroundSettings, setBackgroundSettings] = useState(
    () => getBackgroundSettings()
  );

  const [customBackgroundUrl, setCustomBackgroundUrl] = useState(null);
  const [highwayBackgroundUrl, setHighwayBackgroundUrl] = useState(null);
  const customBackgroundVideoRef = useRef(null);


  /* ==========================================================
     CANVAS
  ========================================================== */

  const animationRef =
    useRef(null);

  const canvasRef =
    useRef(null);

  const canvasContextRef =
    useRef(null);

  const canvasSizeRef =
    useRef({
      width: 0,
      height: 0,
      dpr: 1,
    });


  /* ==========================================================
     HITPADS / FEEDBACK
  ========================================================== */

  const hitPadRefs =
    useRef(new Map());

  const fireEffectRefs =
    useRef(new Map());

  const sustainFireRefs =
    useRef(new Map());

  const fireTimersRef =
    useRef(new Map());


  /* ==========================================================
     CLOCK
  ========================================================== */

  const currentTimeRef =
    useRef(0);

  const noteStartIndexRef =
    useRef(0);


  /* ==========================================================
     GAMEPLAY
  ========================================================== */

  const hitNotesRef =
    useRef(new Set());

  const resolvedNotesRef =
    useRef(new Set());

  const failedNotesRef =
    useRef(new Set());

  const activeSustainsRef =
    useRef(new Map());

  const pressedKeysRef =
    useRef(new Set());

  const missedNotesRef =
    useRef(new Set());


  /* ==========================================================
     SCORE
  ========================================================== */

  const scoreRef =
    useRef(0);

  const hitCountRef =
    useRef(0);

  const missCountRef =
    useRef(0);

  const comboRef =
    useRef(0);

  const multiplierRef =
    useRef(1);

  const maxComboRef =
    useRef(0);


  /* ==========================================================
     SISTEMA
  ========================================================== */

  const audioContextRef =
    useRef(null);

  const lastMissCheckRef =
    useRef(0);

  const isPausedRef =
    useRef(false);


  /* ==========================================================
     LIGHTNING
  ========================================================== */

  const lightningActiveRef =
    useRef(false);

  const lightningMeterRef =
    useRef(100);


  /* ==========================================================
     STATE
  ========================================================== */

  const [
    displayTime,
    setDisplayTime,
  ] = useState(0);

  const [
    chart,
    setChart,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    finished,
    setFinished,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(null);

  const [
    hitCount,
    setHitCount,
  ] = useState(0);

  const [
    missCount,
    setMissCount,
  ] = useState(0);

  const [
    score,
    setScore,
  ] = useState(0);

  const [
    combo,
    setCombo,
  ] = useState(0);

  const [
    multiplier,
    setMultiplier,
  ] = useState(1);

  const [
    maxCombo,
    setMaxCombo,
  ] = useState(0);

  const [
    countdown,
    setCountdown,
  ] = useState(null);

  const [
    isLightningMode,
    setIsLightningMode,
  ] = useState(false);

  const [
    lightningMeter,
    setLightningMeter,
  ] = useState(100);

  const [
    showLightningBolt,
    setShowLightningBolt,
  ] = useState(false);

  const [
    showLightningFlash,
    setShowLightningFlash,
  ] = useState(false);

  const [
    videoReady,
    setVideoReady,
  ] = useState(false);

  const [
    audioReady,
    setAudioReady,
  ] = useState(false);


  /* ==========================================================
     TEMPO VISUAL
  ========================================================== */

  const getTravelTime =
    (diff) => {
      switch (
        diff.toLowerCase()
      ) {
        case "easy":
          return 1.55;

        case "medium":
          return 2.00;

        case "hard":
          return 2.00;

        case "expert":
          return 1.80;

        default:
          return 1.40;
      }
    };


  const NOTE_TRAVEL_TIME =
    useMemo(
      () =>
        getTravelTime(
          difficulty
        ),
      [difficulty]
    );


  const getNoteDuration =
    getNoteDurationFast;


  /* ==========================================================
     PREPARAR CHART
  ========================================================== */

  const preparedNotes =
    useMemo(
      () => {
        if (
          !chart?.notes
        ) {
          return [];
        }

        return chart.notes.map(
          (note) => {
            const duration =
              Number(
                note.duration
              ) || 0;

            return {
              ...note,

              time:
                Number(
                  note.time
                ) || 0,

              lane:
                Number(
                  note.lane
                ) || 0,

              duration:
                duration >=
                MIN_SUSTAIN_DURATION
                  ? duration
                  : 0,
            };
          }
        );
      },
      [chart]
    );


  /* ==========================================================
     RELEASE ALL KEYS
  ========================================================== */

  const releaseAllKeys =
    () => {
      pressedKeysRef.current.clear();

      hitPadRefs.current.forEach(
        (element) => {
          if (!element) {
            return;
          }

          element.classList.remove(
            "hit-pad-pressed",
            "sustain-holding",
            "pad-key-active"
          );

          element.setAttribute(
            "aria-pressed",
            "false"
          );

          const inner =
            element.querySelector(
              ".hit-pad-inner"
            );

          if (inner) {
            inner.classList.remove(
              "pad-key-active",
              "sustain-pad-core-active"
            );

            inner.style.transform =
              "";

            inner.style.filter =
              "";
          }
        }
      );


      fireEffectRefs.current.forEach(
        (fire) => {
          if (!fire) {
            return;
          }

          fire.style.animation =
            "none";

          fire.style.opacity =
            "0";
        }
      );


      sustainFireRefs.current.forEach(
        (fire) => {
          if (!fire) {
            return;
          }

          fire.style.opacity =
            "0";

          fire.style.visibility =
            "hidden";
        }
      );


      fireTimersRef.current.forEach(
        (timer) =>
          clearTimeout(
            timer
          )
      );

      fireTimersRef.current.clear();
    };


  /* ==========================================================
     CARREGAR BACKGROUNDS PERSONALIZADOS
  ========================================================== */

  useEffect(() => {
    let cancelled = false;
    let mainUrl = null;
    let highwayUrl = null;

    async function loadBackgrounds() {
      try {
        const saved = getBackgroundSettings();
        if (cancelled) return;

        setBackgroundSettings(saved);

        if (saved.backgroundMode === "image" && saved.backgroundImageId) {
          const blob = await getBackgroundAsset(saved.backgroundImageId);
          if (blob && !cancelled) {
            mainUrl = URL.createObjectURL(blob);
            setCustomBackgroundUrl(mainUrl);
          }
        } else if (saved.backgroundMode === "video" && saved.backgroundVideoId) {
          const blob = await getBackgroundAsset(saved.backgroundVideoId);
          if (blob && !cancelled) {
            mainUrl = URL.createObjectURL(blob);
            setCustomBackgroundUrl(mainUrl);
          }
        }

        if (saved.highwayImageId) {
          const blob = await getBackgroundAsset(saved.highwayImageId);
          if (blob && !cancelled) {
            highwayUrl = URL.createObjectURL(blob);
            setHighwayBackgroundUrl(highwayUrl);
          }
        }
      } catch (err) {
        console.error("[Guitar Livre] Erro ao carregar backgrounds:", err);
      }
    }

    loadBackgrounds();

    return () => {
      cancelled = true;
      if (mainUrl) URL.revokeObjectURL(mainUrl);
      if (highwayUrl) URL.revokeObjectURL(highwayUrl);
    };
  }, []);

  /* ==========================================================
     ATUALIZAR BACKGROUNDS APÓS SALVAR
  ========================================================== */

  useEffect(() => {
    const handleBackgroundChange = async (event) => {
      const next = event.detail || getBackgroundSettings();
      setBackgroundSettings(next);

      try {
        let mainUrl = null;
        let highwayUrl = null;

        if (next.backgroundMode === "image" && next.backgroundImageId) {
          const blob = await getBackgroundAsset(next.backgroundImageId);
          if (blob) mainUrl = URL.createObjectURL(blob);
        } else if (next.backgroundMode === "video" && next.backgroundVideoId) {
          const blob = await getBackgroundAsset(next.backgroundVideoId);
          if (blob) mainUrl = URL.createObjectURL(blob);
        }

        if (next.highwayImageId) {
          const blob = await getBackgroundAsset(next.highwayImageId);
          if (blob) highwayUrl = URL.createObjectURL(blob);
        }

        setCustomBackgroundUrl((oldUrl) => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          return mainUrl;
        });

        setHighwayBackgroundUrl((oldUrl) => {
          if (oldUrl) URL.revokeObjectURL(oldUrl);
          return highwayUrl;
        });
      } catch (err) {
        console.error("[Guitar Livre] Erro ao atualizar backgrounds:", err);
      }
    };

    window.addEventListener("guitarLivreBackgroundSettingsChanged", handleBackgroundChange);
    return () => window.removeEventListener("guitarLivreBackgroundSettingsChanged", handleBackgroundChange);
  }, []);

  /* ==========================================================
     SINCRONIZAR VÍDEO PERSONALIZADO
  ========================================================== */

  useEffect(() => {
    if (backgroundSettings.backgroundMode !== "video" || !customBackgroundUrl) return;

    const customVideo = customBackgroundVideoRef.current;
    const audio = audioRef.current;
    if (!customVideo || !audio) return;

    const sync = () => {
      const targetTime = audio.currentTime;
      if (Number.isFinite(targetTime) && Math.abs(customVideo.currentTime - targetTime) > 0.05) {
        try { customVideo.currentTime = targetTime; } catch {}
      }

      if (audio.paused || isPausedRef.current) {
        if (!customVideo.paused) customVideo.pause();
      } else if (customVideo.paused) {
        customVideo.play().catch(() => {});
      }
    };

    sync();
    const interval = window.setInterval(sync, 100);
    return () => window.clearInterval(interval);
  }, [backgroundSettings.backgroundMode, customBackgroundUrl]);

  /* ==========================================================
     VOLUME
  ========================================================== */

  useEffect(
    () => {
      if (
        audioRef.current
      ) {
        audioRef.current.volume =
          settings.volume /
          100;
      }

      if (
        videoRef.current
      ) {
        videoRef.current.volume =
          0;
      }
    },
    [settings.volume]
  );


  /* ==========================================================
     PAUSE REF
  ========================================================== */

  useEffect(
    () => {
      isPausedRef.current =
        isPaused;
    },
    [isPaused]
  );


  /* ==========================================================
     RESET
  ========================================================== */

  const resetGame =
    () => {
      noteStartIndexRef.current =
        0;

      currentTimeRef.current =
        0;

      hitNotesRef.current.clear();

      resolvedNotesRef.current.clear();

      failedNotesRef.current.clear();

      activeSustainsRef.current.clear();

      releaseAllKeys();

      hitCountRef.current =
        0;

      missCountRef.current =
        0;

      scoreRef.current =
        0;

      comboRef.current =
        0;

      multiplierRef.current =
        1;

      maxComboRef.current =
        0;

      missedNotesRef.current.clear();

      lastMissCheckRef.current =
        0;

      lightningActiveRef.current =
        false;

      lightningMeterRef.current =
        100;


      setHitCount(0);
      setMissCount(0);
      setScore(0);
      setCombo(0);
      setMultiplier(1);
      setMaxCombo(0);


      setIsLightningMode(
        false
      );

      setLightningMeter(
        100
      );

      setShowLightningBolt(
        false
      );

      setShowLightningFlash(
        false
      );


      if (
        audioRef.current
      ) {
        audioRef.current.pause();

        audioRef.current.currentTime =
          0;
      }


      setIsPaused(false);

      setShowPauseMenu(
        false
      );

      setPendingAction(
        null
      );
    };


  /* ==========================================================
     LOAD CHART
  ========================================================== */

  useEffect(
    () => {
      let cancelled =
        false;

      async function loadChart() {
        try {
          setLoading(true);

          setError(null);


          const chartUrl =
            `${API_URL}/storage/songs/${song.id}/chart_${difficulty}.json`;


          const response =
            await fetch(
              chartUrl
            );


          if (
            !response.ok
          ) {
            throw new Error(
              `Não foi possível carregar o chart (${response.status})`
            );
          }


          const data =
            await response.json();


          if (
            cancelled
          ) {
            return;
          }


          console.log(
            `[Guitar Livre] Chart carregado: ${data.notes.length} notas`
          );


          resetGame();


          setCountdown(
            3
          );


          setChart(
            data
          );
        } catch (
          err
        ) {
          if (
            cancelled
          ) {
            return;
          }

          console.error(
            err
          );

          setError(
            err.message
          );
        } finally {
          if (
            !cancelled
          ) {
            setLoading(
              false
            );
          }
        }
      }


      loadChart();


      return () => {
        cancelled =
          true;
      };
    },
    [
      song.id,
      difficulty,
    ]
  );


  /* ==========================================================
     COUNTDOWN
  ========================================================== */

  useEffect(
    () => {
      if (
        countdown === null ||
        countdown <= 0
      ) {
        return;
      }


      const timer =
        setTimeout(
          () => {
            if (
              countdown ===
              1
            ) {
              const video =
                videoRef.current;

              const audio =
                audioRef.current;


              if (
                video &&
                audio
              ) {
                if (
                  pendingAction ===
                  "resume"
                ) {
                  video.currentTime =
                    audio.currentTime;

                  Promise.allSettled(
                    [
                      audio.play(),
                      video.play(),
                    ]
                  );
                } else {
                  audio.currentTime =
                    0;

                  video.currentTime =
                    0;

                  Promise.allSettled(
                    [
                      audio.play(),
                      video.play(),
                    ]
                  );
                }
              }


              setPendingAction(
                null
              );

              setCountdown(
                0
              );

              setIsPaused(
                false
              );

              setShowPauseMenu(
                false
              );
            } else {
              setCountdown(
                (
                  previous
                ) =>
                  previous - 1
              );
            }
          },
          1000
        );


      return () =>
        clearTimeout(
          timer
        );
    },
    [
      countdown,
      pendingAction,
    ]
  );


  /* ==========================================================
     ESC / PAUSE
  ========================================================== */

  useEffect(
    () => {
      const handleEscape =
        (event) => {
          if (
            event.key !==
            "Escape"
          ) {
            return;
          }


          if (
            finished ||
            loading ||
            error
          ) {
            return;
          }


          if (
            isPaused
          ) {
            setIsPaused(
              false
            );

            setShowPauseMenu(
              false
            );


            const audio =
              audioRef.current;

            const video =
              videoRef.current;


            if (
              audio &&
              video
            ) {
              video.currentTime =
                audio.currentTime;

              Promise.allSettled(
                [
                  audio.play(),
                  video.play(),
                ]
              );
            }
          } else {
            releaseAllKeys();

            setIsPaused(
              true
            );

            setShowPauseMenu(
              true
            );

            audioRef.current?.pause();

            videoRef.current?.pause();
          }
        };


      window.addEventListener(
        "keydown",
        handleEscape
      );


      return () =>
        window.removeEventListener(
          "keydown",
          handleEscape
        );
    },
    [
      isPaused,
      finished,
      loading,
      error,
    ]
  );


  /* ==========================================================
     MENU PAUSA
  ========================================================== */

  const handlePauseMenuAction =
    (action) => {
      if (
        action ===
        "resume"
      ) {
        setShowPauseMenu(
          false
        );

        setPendingAction(
          "resume"
        );

        setCountdown(
          3
        );

        releaseAllKeys();

        return;
      }


      if (
        action ===
        "restart"
      ) {
        resetGame();

        setPendingAction(
          "restart"
        );

        setCountdown(
          3
        );

        setIsPaused(
          false
        );

        setShowPauseMenu(
          false
        );


        if (
          videoRef.current
        ) {
          videoRef.current.currentTime =
            0;

          videoRef.current.pause();
        }

        return;
      }


      if (
        action ===
        "exit"
      ) {
        videoRef.current?.pause();

        audioRef.current?.pause();

        releaseAllKeys();

        setIsPaused(
          false
        );

        setShowPauseMenu(
          false
        );

        onBack();
      }
    };


  /* ==========================================================
     AUDIO CONTEXT
  ========================================================== */

  function getAudioContext() {
    if (
      !audioContextRef.current
    ) {
      const AudioContext =
        window.AudioContext ||
        window.webkitAudioContext;


      if (
        !AudioContext
      ) {
        return null;
      }


      audioContextRef.current =
        new AudioContext();
    }


    const context =
      audioContextRef.current;


    if (
      context.state ===
      "suspended"
    ) {
      context.resume();
    }


    return context;
  }


  /* ==========================================================
     THUNDER
  ========================================================== */

  function playThunderSound() {
    const context =
      getAudioContext();

    if (!context) {
      return;
    }


    const duration =
      0.35;


    const bufferSize =
      Math.floor(
        context.sampleRate *
          duration
      );


    const buffer =
      context.createBuffer(
        1,
        bufferSize,
        context.sampleRate
      );


    const data =
      buffer.getChannelData(
        0
      );


    for (
      let i = 0;
      i < bufferSize;
      i++
    ) {
      data[i] =
        (
          Math.random() *
            2 -
          1
        ) *
        (
          1 -
          i /
            bufferSize
        );
    }


    const source =
      context.createBufferSource();


    source.buffer =
      buffer;


    const lowpass =
      context.createBiquadFilter();


    lowpass.type =
      "lowpass";


    lowpass.frequency.value =
      420;


    lowpass.Q.value =
      0.5;


    const gain =
      context.createGain();


    gain.gain.setValueAtTime(
      0.45,
      context.currentTime
    );


    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime +
        duration
    );


    source.connect(
      lowpass
    );


    lowpass.connect(
      gain
    );


    gain.connect(
      context.destination
    );


    source.start();


    source.stop(
      context.currentTime +
        duration
    );


    const crack =
      context.createOscillator();


    const crackGain =
      context.createGain();


    crack.type =
      "sawtooth";


    crack.frequency.setValueAtTime(
      1800,
      context.currentTime
    );


    crack.frequency.exponentialRampToValueAtTime(
      120,
      context.currentTime +
        0.08
    );


    crackGain.gain.setValueAtTime(
      0.25,
      context.currentTime
    );


    crackGain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime +
        0.08
    );


    crack.connect(
      crackGain
    );


    crackGain.connect(
      context.destination
    );


    crack.start();


    crack.stop(
      context.currentTime +
        0.08
    );
  }


  /* ==========================================================
     LIGHTNING
  ========================================================== */

  function activateLightningMode() {
    if (
      lightningActiveRef.current
    ) {
      return;
    }


    lightningActiveRef.current =
      true;


    lightningMeterRef.current =
      100;


    setIsLightningMode(
      true
    );


    setLightningMeter(
      100
    );


    setShowLightningBolt(
      true
    );


    setShowLightningFlash(
      true
    );


    playThunderSound();


    if (
      audioRef.current
    ) {
      audioRef.current.volume =
        Math.min(
          1.0,
          (
            settings.volume /
            100
          ) *
            1.3
        );
    }
  }


  function deactivateLightningMode() {
    lightningActiveRef.current =
      false;


    lightningMeterRef.current =
      0;


    setIsLightningMode(
      false
    );


    setLightningMeter(
      0
    );


    if (
      audioRef.current
    ) {
      audioRef.current.volume =
        settings.volume /
        100;
    }


    comboRef.current =
      0;


    setCombo(
      0
    );


    multiplierRef.current =
      1;


    setMultiplier(
      1
    );
  }


  function applyLightningPenalty() {
    if (
      !lightningActiveRef.current
    ) {
      return;
    }


    lightningMeterRef.current =
      Math.max(
        0,
        lightningMeterRef.current -
          15
      );
  }


  /* ==========================================================
     CANVAS RESIZE
  ========================================================== */

  function resizeGameplayCanvas() {
    const canvas =
      canvasRef.current;

    if (!canvas) {
      return;
    }


    const rect =
      canvas.getBoundingClientRect();


    const dpr =
      Math.min(
        window.devicePixelRatio ||
          1,
        1.5
      );


    const width =
      Math.max(
        1,
        Math.round(
          rect.width *
            dpr
        )
      );


    const height =
      Math.max(
        1,
        Math.round(
          rect.height *
            dpr
        )
      );


    if (
      canvas.width !==
        width ||
      canvas.height !==
        height
    ) {
      canvas.width =
        width;

      canvas.height =
        height;

      canvasContextRef.current =
        null;
    }


    canvasSizeRef.current =
      {
        width:
          rect.width,

        height:
          rect.height,

        dpr,
      };
  }


  /* ==========================================================
     CANVAS CONTEXT
  ========================================================== */

  function getGameplayContext() {
    const canvas =
      canvasRef.current;


    if (!canvas) {
      return null;
    }


    if (
      !canvasContextRef.current
    ) {
      canvasContextRef.current =
        canvas.getContext(
          "2d",
          {
            alpha: true,
            desynchronized: true,
          }
        );
    }


    return canvasContextRef.current;
  }


  /* ==========================================================
     DESENHO DA NOTA
  ========================================================== */

  function drawCanvasNote(
    ctx,
    x,
    y,
    scale,
    color
  ) {
    const width =
      72 *
      scale;

    const height =
      42 *
      scale;


    /*
     * Glow leve.
     */

    ctx.globalAlpha =
      0.18;

    ctx.fillStyle =
      color;


    ctx.beginPath();

    ctx.ellipse(
      x,
      y,
      width *
        0.68,
      height *
        0.68,
      0,
      0,
      Math.PI *
        2
    );

    ctx.fill();


    /*
     * Corpo
     */

    ctx.globalAlpha =
      1;

    ctx.fillStyle =
      color;


    ctx.beginPath();

    ctx.ellipse(
      x,
      y,
      width *
        0.5,
      height *
        0.5,
      0,
      0,
      Math.PI *
        2
    );

    ctx.fill();


    /*
     * Contorno
     */

    ctx.lineWidth =
      Math.max(
        1.5,
        3 *
          scale
      );


    ctx.strokeStyle =
      "rgba(255,255,255,0.92)";


    ctx.stroke();


    /*
     * Núcleo.
     */

    ctx.globalAlpha =
      0.95;

    ctx.fillStyle =
      "#ffffff";


    ctx.beginPath();

    ctx.ellipse(
      x,
      y,
      width *
        0.17,
      height *
        0.28,
      0,
      0,
      Math.PI *
        2
    );

    ctx.fill();


    ctx.globalAlpha =
      1;
  }


  /* ==========================================================
     RENDER CANVAS
  ========================================================== */

  function drawGameplayCanvas(
    currentTime
  ) {
    const canvas =
      canvasRef.current;

    const ctx =
      getGameplayContext();


    if (
      !canvas ||
      !ctx
    ) {
      return;
    }


    const {
      width,
      height,
      dpr,
    } =
      canvasSizeRef.current;


    if (
      !width ||
      !height
    ) {
      return;
    }


    ctx.setTransform(
      dpr,
      0,
      0,
      dpr,
      0,
      0
    );


    ctx.clearRect(
      0,
      0,
      width,
      height
    );


    const notes =
      preparedNotes;


    if (
      !notes.length
    ) {
      return;
    }


    let startIndex =
      noteStartIndexRef.current;


    /*
     * Remove notas definitivamente antigas
     * da janela de gameplay.
     */

    while (
      startIndex <
      notes.length
    ) {
      const candidate =
        notes[
          startIndex
        ];


      const duration =
        getNoteDurationFast(
          candidate
        );


      const candidateEnd =
        candidate.time +
        duration;


      if (
        candidateEnd >=
        currentTime -
          0.15
      ) {
        break;
      }


      startIndex++;
    }


    noteStartIndexRef.current =
      startIndex;


    const travelTime =
      NOTE_TRAVEL_TIME;


    const hits =
      hitNotesRef.current;

    const failed =
      failedNotesRef.current;

    const resolved =
      resolvedNotesRef.current;

    const activeSustains =
      activeSustainsRef.current;

    const lightning =
      lightningActiveRef.current;


    /*
     * SOMENTE NOTAS VISÍVEIS.
     */

    for (
      let i =
        startIndex;
      i <
        notes.length;
      i++
    ) {
      const note =
        notes[i];


      if (
        note.time >
        currentTime +
          travelTime
      ) {
        break;
      }


      if (
        failed.has(i)
      ) {
        continue;
      }


      const duration =
        getNoteDurationFast(
          note
        );


      const isHit =
        hits.has(i);


      const sustainActive =
        activeSustains.has(i);


      const color =
        lightning
          ? "#00ffff"
          : LANE_COLORS[
              note.lane %
                LANES
            ];


      const geometry =
        LANE_GEOMETRY[
          note.lane
        ] ||
        LANE_GEOMETRY[0];


      /*
       * CABEÇA
       */

      const headProgress =
        (
          note.time -
          currentTime
        ) /
        travelTime;


      const headDepth =
        Math.max(
          0,
          Math.min(
            1,
            1 -
              headProgress
          )
        );


      const headVisual =
        Math.pow(
          headDepth,
          1.22
        );


      const headCenter =
        geometry.topCenter +
        (
          geometry.bottomCenter -
          geometry.topCenter
        ) *
          headVisual;


      const headTop =
        8 +
        headVisual *
          77;


      /*
       * SUSTAIN
       */

      if (
        duration >
        0
      ) {
        const noteEndTime =
          note.time +
          duration;


        if (
          currentTime >
          noteEndTime
        ) {
          continue;
        }


        const tailProgress =
          (
            noteEndTime -
            currentTime
          ) /
          travelTime;


        const tailDepth =
          Math.max(
            0,
            Math.min(
              1,
              1 -
                tailProgress
            )
          );


        const tailVisual =
          Math.pow(
            tailDepth,
            1.4
          );


        const tailCenter =
          geometry.topCenter +
          (
            geometry.bottomCenter -
            geometry.topCenter
          ) *
            tailVisual;


        const tailTop =
          8 +
          tailVisual *
            77;


        const bottomCenter =
          isHit
            ? geometry.bottomCenter
            : headCenter;


        const bottomTop =
          isHit
            ? HIT_LINE_TOP
            : headTop;


        const barTop =
          Math.min(
            tailTop,
            bottomTop
          );


        const barHeight =
          Math.max(
            0,
            bottomTop -
              barTop
          );


        if (
          barHeight >
          0.1
        ) {
          const topWidth =
            (
              geometry.topRight -
              geometry.topLeft
            ) *
            SUSTAIN_WIDTH_RATIO;


          const bottomWidth =
            (
              geometry.bottomRight -
              geometry.bottomLeft
            ) *
            SUSTAIN_WIDTH_RATIO;


          const y1 =
            (
              barTop /
              100
            ) *
            height;


          const y2 =
            (
              (
                barTop +
                barHeight
              ) /
              100
            ) *
            height;


          const tailX =
            (
              tailCenter /
              100
            ) *
            width;


          const bottomX =
            (
              bottomCenter /
              100
            ) *
            width;


          const tailW =
            (
              topWidth /
              100
            ) *
            width;


          const bottomW =
            (
              bottomWidth /
              100
            ) *
            width;


          ctx.globalAlpha =
            isHit
              ? 0.95
              : 0.82;


          ctx.fillStyle =
            color;


          ctx.beginPath();


          ctx.moveTo(
            tailX -
              tailW /
                2,
            y1
          );


          ctx.lineTo(
            tailX +
              tailW /
                2,
            y1
          );


          ctx.lineTo(
            bottomX +
              bottomW /
                2,
            y2
          );


          ctx.lineTo(
            bottomX -
              bottomW /
                2,
            y2
          );


          ctx.closePath();


          ctx.fill();


          /*
           * Glow/contorno durante sustain.
           */

          if (
            sustainActive
          ) {
            ctx.globalAlpha =
              0.85;

            ctx.lineWidth =
              1.75;

            ctx.strokeStyle =
              "rgba(255,255,255,0.78)";

            ctx.stroke();
          }


          ctx.globalAlpha =
            1;
        }


        /*
         * Cabeça não consumida.
         */

        if (
          !isHit &&
          !resolved.has(i) &&
          currentTime <=
            note.time +
              HIT_WINDOW
        ) {
          drawCanvasNote(
            ctx,
            (
              headCenter /
              100
            ) *
              width,
            (
              headTop /
              100
            ) *
              height,
            NOTE_SCALE_MIN +
              headVisual *
                NOTE_SCALE_RANGE,
            color
          );
        }


        continue;
      }


      /*
       * NOTA NORMAL.
       */

      if (
        resolved.has(i) ||
        isHit
      ) {
        continue;
      }


      if (
        currentTime >
        note.time +
          HIT_WINDOW
      ) {
        continue;
      }


      drawCanvasNote(
        ctx,
        (
          headCenter /
          100
        ) *
          width,
        (
          headTop /
          100
        ) *
          height,
        NOTE_SCALE_MIN +
          headVisual *
            NOTE_SCALE_RANGE,
        color
      );
    }
  }


  /* ==========================================================
     SUSTAIN = REGRA 80%
  ========================================================== */

  function getSustainCompletionTime(
    sustain
  ) {
    if (
      !sustain
    ) {
      return Infinity;
    }


    const duration =
      sustain.endTime -
      sustain.startTime;


    return (
      sustain.startTime +
      duration *
        SUSTAIN_COMPLETION_RATIO
    );
  }


  /* ==========================================================
     LOOP PRINCIPAL
  ========================================================== */

  useEffect(
    () => {
      if (!chart) {
        return;
      }


      const audio =
        audioRef.current;


      const canvas =
        canvasRef.current;


      if (
        !audio ||
        !canvas
      ) {
        return;
      }


      resizeGameplayCanvas();


      let resizeObserver =
        null;


      if (
        typeof ResizeObserver !==
        "undefined"
      ) {
        resizeObserver =
          new ResizeObserver(
            () =>
              resizeGameplayCanvas()
          );


        resizeObserver.observe(
          canvas
        );
      } else {
        window.addEventListener(
          "resize",
          resizeGameplayCanvas
        );
      }


      let lastHudUpdate =
        0;


      let lastVideoSync =
        0;


      const animate =
        (timestamp) => {
          try {
            /*
             * AUDIO = MASTER CLOCK
             */

            const time =
              audio.currentTime;


            currentTimeRef.current =
              time;


            /*
             * Sincronização do vídeo.
             */

            if (
              timestamp -
                lastVideoSync >=
              VIDEO_SYNC_INTERVAL
            ) {
              lastVideoSync =
                timestamp;


              const video =
                videoRef.current;


              if (
                video &&
                !video.paused &&
                Math.abs(
                  video.currentTime -
                    time
                ) >
                  0.045
              ) {
                video.currentTime =
                  time;
              }
            }


            /*
             * Render Canvas.
             */

            drawGameplayCanvas(
              time
            );


            /*
             * SUSTAINS
             *
             * O sustain é considerado
             * concluído ao chegar nos
             * 80% da duração.
             */

            for (
              const [
                index,
                sustain,
              ] of activeSustainsRef.current.entries()
            ) {
              const completionTime =
                getSustainCompletionTime(
                  sustain
                );


              if (
                time >=
                completionTime
              ) {
                completeSustain(
                  index
                );
              }
            }


            /*
             * MISS CHECK
             */

            if (
              timestamp -
                lastMissCheckRef.current >
              25
            ) {
              lastMissCheckRef.current =
                timestamp;


              for (
                let i =
                  noteStartIndexRef.current;
                i <
                  preparedNotes.length;
                i++
              ) {
                const note =
                  preparedNotes[i];


                if (
                  note.time +
                    HIT_WINDOW >=
                  time
                ) {
                  break;
                }


                if (
                  hitNotesRef.current.has(
                    i
                  ) ||
                  resolvedNotesRef.current.has(
                    i
                  ) ||
                  failedNotesRef.current.has(
                    i
                  ) ||
                  missedNotesRef.current.has(
                    i
                  )
                ) {
                  continue;
                }


                registerFailedHit(
                  i,
                  note.lane
                );
              }
            }


            /*
             * HUD
             */

            if (
              timestamp -
                lastHudUpdate >=
              HUD_RENDER_INTERVAL
            ) {
              lastHudUpdate =
                timestamp;


              setDisplayTime(
                time
              );


              setScore(
                scoreRef.current
              );


              setCombo(
                comboRef.current
              );


              setMultiplier(
                multiplierRef.current
              );


              setMaxCombo(
                maxComboRef.current
              );


              setHitCount(
                hitCountRef.current
              );


              setMissCount(
                missCountRef.current
              );


              /*
               * Lightning
               */

              if (
                lightningActiveRef.current &&
                !isPausedRef.current
              ) {
                lightningMeterRef.current =
                  Math.max(
                    0,
                    lightningMeterRef.current -
                      0.8
                  );


                setLightningMeter(
                  lightningMeterRef.current
                );


                if (
                  lightningMeterRef.current <=
                  0
                ) {
                  deactivateLightningMode();
                }
              }
            }


            animationRef.current =
              requestAnimationFrame(
                animate
              );
          } catch (
            animationError
          ) {
            console.error(
              "Erro no loop:",
              animationError
            );


            animationRef.current =
              requestAnimationFrame(
                animate
              );
          }
        };


      animationRef.current =
        requestAnimationFrame(
          animate
        );


      return () => {
        cancelAnimationFrame(
          animationRef.current
        );


        if (
          resizeObserver
        ) {
          resizeObserver.disconnect();
        } else {
          window.removeEventListener(
            "resize",
            resizeGameplayCanvas
          );
        }
      };
    },
    [
      chart,
      preparedNotes,
    ]
  );


  /* ==========================================================
     FIRE NORMAL
  ========================================================== */

  function createFireEffect(
    lane
  ) {
    const fire =
      fireEffectRefs.current.get(
        lane
      );


    if (!fire) {
      return;
    }


    const previousTimer =
      fireTimersRef.current.get(
        lane
      );


    if (
      previousTimer
    ) {
      clearTimeout(
        previousTimer
      );
    }


    fire.style.animation =
      "none";


    fire.style.opacity =
      "1";


    /*
     * Força reinício da animação.
     */

    void fire.offsetWidth;


    fire.style.animation =
      "fireCycle 0.2s cubic-bezier(0.2, 0.9, 0.4, 1) forwards";


    const timer =
      window.setTimeout(
        () => {
          if (
            !fire.isConnected
          ) {
            return;
          }


          fire.style.animation =
            "none";


          fire.style.opacity =
            "0";


          fireTimersRef.current.delete(
            lane
          );
        },
        220
      );


    fireTimersRef.current.set(
      lane,
      timer
    );
  }


  /* ==========================================================
     FIRE SUSTAIN
  ========================================================== */

  function setSustainFire(
    lane,
    active
  ) {
    const pad =
      hitPadRefs.current.get(
        lane
      );


    const fire =
      sustainFireRefs.current.get(
        lane
      );


    if (pad) {
      pad.classList.toggle(
        "sustain-holding",
        active
      );


      pad.setAttribute(
        "aria-pressed",
        active
          ? "true"
          : "false"
      );


      const inner =
        pad.querySelector(
          ".hit-pad-inner"
        );


      if (inner) {
        inner.classList.toggle(
          "sustain-pad-core-active",
          active
        );
      }
    }


    if (fire) {
      fire.style.opacity =
        active
          ? "1"
          : "0";


      fire.style.visibility =
        active
          ? "visible"
          : "hidden";
    }
  }


  /* ==========================================================
     PRESS LANE
  ========================================================== */

  function pressLane(
    lane
  ) {
    const element =
      hitPadRefs.current.get(
        lane
      );


    if (!element) {
      return;
    }


    /*
     * Feedback imediato.
     */

    element.classList.add(
      "hit-pad-pressed",
      "pad-key-active"
    );


    element.setAttribute(
      "aria-pressed",
      "true"
    );


    const inner =
      element.querySelector(
        ".hit-pad-inner"
      );


    if (inner) {
      inner.classList.add(
        "pad-key-active"
      );


      inner.style.transform =
        "scale(1.05)";


      inner.style.filter =
        "brightness(1.5)";
    }
  }


  /* ==========================================================
     RELEASE LANE
  ========================================================== */

  function releaseLane(
    lane
  ) {
    const element =
      hitPadRefs.current.get(
        lane
      );


    if (!element) {
      return;
    }


    element.classList.remove(
      "hit-pad-pressed",
      "sustain-holding",
      "pad-key-active"
    );


    element.setAttribute(
      "aria-pressed",
      "false"
    );


    const inner =
      element.querySelector(
        ".hit-pad-inner"
      );


    if (inner) {
      inner.classList.remove(
        "pad-key-active",
        "sustain-pad-core-active"
      );


      inner.style.transform =
        "";


      inner.style.filter =
        "";
    }


    const fire =
      sustainFireRefs.current.get(
        lane
      );


    if (fire) {
      fire.style.opacity =
        "0";


      fire.style.visibility =
        "hidden";
    }
  }


  /* ==========================================================
     SUCCESS HIT
  ========================================================== */

  function registerSuccessfulHit(
    index,
    lane
  ) {
    if (
      resolvedNotesRef.current.has(
        index
      )
    ) {
      return;
    }


    if (
      failedNotesRef.current.has(
        index
      )
    ) {
      return;
    }


    resolvedNotesRef.current.add(
      index
    );


    const newCombo =
      comboRef.current +
      1;


    comboRef.current =
      newCombo;


    setCombo(
      newCombo
    );


    if (
      newCombo >
      maxComboRef.current
    ) {
      maxComboRef.current =
        newCombo;


      setMaxCombo(
        newCombo
      );
    }


    const newMultiplier =
      1 +
      Math.floor(
        newCombo /
          10
      );


    multiplierRef.current =
      newMultiplier;


    setMultiplier(
      newMultiplier
    );


    const points =
      100 *
      newMultiplier;


    scoreRef.current +=
      points;


    hitCountRef.current +=
      1;


    setScore(
      scoreRef.current
    );


    setHitCount(
      hitCountRef.current
    );


    createFireEffect(
      lane
    );


    if (
      newMultiplier >=
      10
    ) {
      activateLightningMode();
    }
  }


  /* ==========================================================
     FAILED HIT
  ========================================================== */

  function registerFailedHit(
    index,
    lane
  ) {
    if (
      resolvedNotesRef.current.has(
        index
      )
    ) {
      return;
    }


    if (
      failedNotesRef.current.has(
        index
      )
    ) {
      return;
    }


    failedNotesRef.current.add(
      index
    );


    missedNotesRef.current.add(
      index
    );


    activeSustainsRef.current.delete(
      index
    );


    missCountRef.current +=
      1;


    comboRef.current =
      0;


    multiplierRef.current =
      1;


    setMissCount(
      missCountRef.current
    );


    setCombo(
      0
    );


    setMultiplier(
      1
    );


    applyLightningPenalty();
  }


  /* ==========================================================
     COMPLETE SUSTAIN
  ========================================================== */

  function completeSustain(
    index
  ) {
    const sustain =
      activeSustainsRef.current.get(
        index
      );


    if (!sustain) {
      return;
    }


    activeSustainsRef.current.delete(
      index
    );


    registerSuccessfulHit(
      index,
      sustain.lane
    );
  }


  /* ==========================================================
     FAIL SUSTAIN
  ========================================================== */

  function failSustain(
    index
  ) {
    const sustain =
      activeSustainsRef.current.get(
        index
      );


    if (!sustain) {
      return;
    }


    registerFailedHit(
      index,
      sustain.lane
    );
  }


  /* ==========================================================
     HOLDING SUSTAIN?
  ========================================================== */

  function isHoldingSustainOnLane(
    lane
  ) {
    for (
      const sustain
        of activeSustainsRef.current.values()
    ) {
      if (
        sustain.lane ===
        lane
      ) {
        return true;
      }
    }


    return false;
  }


  /* ==========================================================
     FIND NOTE TO HIT
  ========================================================== */

  function findNoteToHit(
    lane,
    exactTime
  ) {
    if (!chart) {
      return null;
    }


    const notes =
      preparedNotes;


    /*
     * Busca somente próximo ao
     * ponteiro atual.
     */

    const start =
      Math.max(
        0,
        noteStartIndexRef.current -
          8
      );


    let bestNote =
      null;


    let bestDifference =
      Infinity;


    for (
      let i =
        start;
      i <
        notes.length;
      i++
    ) {
      const note =
        notes[i];


      if (
        note.time >
        exactTime +
          HIT_WINDOW
      ) {
        break;
      }


      if (
        note.lane !==
        lane
      ) {
        continue;
      }


      if (
        hitNotesRef.current.has(
          i
        ) ||
        resolvedNotesRef.current.has(
          i
        ) ||
        failedNotesRef.current.has(
          i
        )
      ) {
        continue;
      }


      const difference =
        Math.abs(
          note.time -
            exactTime
        );


      if (
        difference >
        HIT_WINDOW
      ) {
        continue;
      }


      if (
        difference <
        bestDifference
      ) {
        bestDifference =
          difference;


        bestNote = {
          note,
          index:
            i,
          difference,
        };


        if (
          difference <=
          0.001
        ) {
          break;
        }
      }
    }


    return bestNote;
  }


  /* ==========================================================
     INPUT DO TECLADO
  ========================================================== */

  useEffect(
    () => {
      function handleKeyDown(
        event
      ) {
        if (
          event.key ===
          "Escape"
        ) {
          return;
        }


        if (
          countdown >
            0 ||
          isPaused ||
          finished
        ) {
          return;
        }


        const key =
          event.key.toUpperCase();


        const lane =
          activeKeys.indexOf(
            key
          );


        if (
          lane ===
          -1
        ) {
          return;
        }


        if (
          event.repeat ||
          pressedKeysRef.current.has(
            key
          )
        ) {
          return;
        }


        event.preventDefault();


        /*
         * Registra fisicamente o
         * pressionamento primeiro.
         */

        pressedKeysRef.current.add(
          key
        );


        /*
         * Feedback visual instantâneo.
         */

        pressLane(
          lane
        );


        /*
         * AUDIO = relógio.
         */

        const audio =
          audioRef.current;


        const exactTime =
          audio
            ? audio.currentTime
            : currentTimeRef.current;


        /*
         * Busca nota.
         */

        const result =
          findNoteToHit(
            lane,
            exactTime
          );


        /*
         * Nenhuma nota válida.
         */

        if (!result) {
          missCountRef.current +=
            1;


          comboRef.current =
            0;


          multiplierRef.current =
            1;


          setMissCount(
            missCountRef.current
          );


          setCombo(
            0
          );


          setMultiplier(
            1
          );


          applyLightningPenalty();


          return;
        }


        const index =
          result.index;


        const noteDuration =
          getNoteDuration(
            result.note
          );


        /*
         * Marca cabeça como atingida.
         */

        hitNotesRef.current.add(
          index
        );


        /*
         * ==============================================
         * SUSTAIN
         * ==============================================
         */

        if (
          noteDuration >
          0
        ) {
          /*
           * IMPORTANTE:
           *
           * A nota NÃO é contabilizada
           * imediatamente.
           *
           * Ela só vira ACERTO quando
           * alcançar 80%.
           */

          activeSustainsRef.current.set(
            index,
            {
              lane,

              startTime:
                result.note.time,

              endTime:
                result.note.time +
                noteDuration,
            }
          );


          /*
           * Fogo contínuo.
           */

          setSustainFire(
            lane,
            true
          );


          /*
           * Fogo da cabeça.
           */

          createFireEffect(
            lane
          );


          return;
        }


        /*
         * ==============================================
         * NOTA NORMAL
         * ==============================================
         */

        registerSuccessfulHit(
          index,
          lane
        );
      }


      /* ========================================================
         KEY UP
      ======================================================== */

      function handleKeyUp(
        event
      ) {
        const key =
          event.key.toUpperCase();


        const lane =
          activeKeys.indexOf(
            key
          );


        if (
          lane ===
          -1
        ) {
          return;
        }


        event.preventDefault();


        pressedKeysRef.current.delete(
          key
        );


        /*
         * Relógio oficial.
         */

        const audio =
          audioRef.current;


        const now =
          audio
            ? audio.currentTime
            : currentTimeRef.current;


        /*
         * Processa os sustains
         * dessa lane.
         */

        for (
          const [
            index,
            sustain,
          ] of activeSustainsRef.current.entries()
        ) {
          if (
            sustain.lane !==
            lane
          ) {
            continue;
          }


          const completionTime =
            getSustainCompletionTime(
              sustain
            );


          /*
           * ==========================================
           * 80% OU MAIS
           * ==========================================
           *
           * SUCESSO.
           */

          if (
            now >=
            completionTime
          ) {
            completeSustain(
              index
            );
          } else {
            /*
             * Menos de 80%.
             *
             * MISS.
             */

            failSustain(
              index
            );
          }
        }


        /*
         * Remove fogo persistente.
         */

        setSustainFire(
          lane,
          false
        );


        /*
         * Libera o pad.
         */

        releaseLane(
          lane
        );
      }


      window.addEventListener(
        "keydown",
        handleKeyDown
      );


      window.addEventListener(
        "keyup",
        handleKeyUp
      );


      return () => {
        window.removeEventListener(
          "keydown",
          handleKeyDown
        );


        window.removeEventListener(
          "keyup",
          handleKeyUp
        );
      };
    },
    [
      countdown,
      isPaused,
      finished,
      activeKeys,
      preparedNotes,
      chart,
    ]
  );


  /* ==========================================================
     AUDIO ENDED
  ========================================================== */

  async function handleAudioEnded() {
    const finalTime =
      audioRef.current?.duration ||
      chart?.duration ||
      0;


    currentTimeRef.current =
      finalTime;


    setDisplayTime(
      finalTime
    );


    setScore(
      scoreRef.current
    );


    setCombo(
      comboRef.current
    );


    setMultiplier(
      multiplierRef.current
    );


    setHitCount(
      hitCountRef.current
    );


    setMissCount(
      missCountRef.current
    );


    setMaxCombo(
      maxComboRef.current
    );


    setFinished(
      true
    );


    releaseAllKeys();


    if (
      user &&
      chart
    ) {
      try {
        const response =
          await fetch(
            `${API_URL}/api/rankings/${song.id}`,
            {
              method:
                "POST",

              headers:
                {
                  "Content-Type":
                    "application/json",
                },

              body:
                JSON.stringify({
                  username:
                    user.username,

                  score:
                    scoreRef.current,

                  difficulty,

                  maxCombo:
                    maxComboRef.current,
                }),
            }
          );


        if (
          !response.ok
        ) {
          console.error(
            "Falha ao salvar pontuação."
          );
        }
      } catch (
        err
      ) {
        console.error(
          "Erro ao enviar pontuação:",
          err
        );
      }
    }
  }


  /* ==========================================================
     RENDER
  ========================================================== */

  const currentTime =
    displayTime;


  /* ==========================================================
     LOADING
  ========================================================== */

  if (loading) {
    return (
      <div className="game-loading">
        <div className="loading-guitar">
          🎸
        </div>

        <h1>
          Preparando música...
        </h1>

        <p>
          Carregando chart
        </p>
      </div>
    );
  }


  /* ==========================================================
     ERROR
  ========================================================== */

  if (error) {
    return (
      <div className="game-loading">
        <h1>
          Não foi possível carregar
          a música
        </h1>

        <p>
          {error}
        </p>

        <button
          onClick={onBack}
        >
          ← Voltar
        </button>
      </div>
    );
  }


  if (!chart) {
    return (
      <div className="game-loading">
        <h1>
          Carregando...
        </h1>
      </div>
    );
  }


  return (
    <div
      className="game"
      data-theme={
        isLightningMode
          ? "lightning"
          : "normal"
      }
    >

      {/* =====================================================
          VÍDEO ORIGINAL DA MÚSICA
      ====================================================== */}

      <video
        ref={videoRef}
        className={`game-video ${
          settings.disableVideo ||
          backgroundSettings.backgroundMode !== "song-video"
            ? "video-disabled"
            : ""
        }`}
        src={`${API_URL}/storage/songs/${song.id}/video.mp4`}
        muted
        playsInline
        preload={
          backgroundSettings.backgroundMode === "song-video"
            ? "metadata"
            : "none"
        }
        style={{
          transform: "translate3d(0,0,0)",
          backfaceVisibility: "hidden",
        }}
        onLoadedMetadata={() => setVideoReady(true)}
        onCanPlay={(event) => {
          setVideoReady(true);
          if (backgroundSettings.backgroundMode !== "song-video") {
            event.currentTarget.pause();
            return;
          }
          const audio = audioRef.current;
          if (countdown === 0 && !isPaused && audio && !audio.paused) {
            event.currentTarget.play().catch(() => {});
          }
        }}
      />

      {backgroundSettings.backgroundMode === "image" && customBackgroundUrl && (
        <img
          className="custom-game-background"
          src={customBackgroundUrl}
          alt=""
          draggable="false"
          aria-hidden="true"
        />
      )}

      {backgroundSettings.backgroundMode === "video" && customBackgroundUrl && (
        <video
          ref={customBackgroundVideoRef}
          className="custom-game-background-video"
          src={customBackgroundUrl}
          muted
          playsInline
          loop
          preload="auto"
          aria-hidden="true"
        />
      )}

      {/* =====================================================
          AUDIO MASTER
      ====================================================== */}

      <audio
        ref={audioRef}
        src={`${API_URL}/storage/songs/${song.id}/master.ogg`}
        preload="auto"
        onLoadedMetadata={(
          event
        ) => {
          event.currentTarget.volume =
            settings.volume /
            100;

          setAudioReady(
            true
          );
        }}
        onCanPlay={() => {
          setAudioReady(
            true
          );
        }}
        onEnded={
          handleAudioEnded
        }
      />


      <div className="game-overlay" />


      {/* =====================================================
          COUNTDOWN
      ====================================================== */}

      {countdown >
        0 && (
        <div className="countdown-overlay">

          <div className="countdown-number">
            {countdown}
          </div>

        </div>
      )}


      {/* =====================================================
          LIGHTNING
      ====================================================== */}

      {showLightningBolt && (
        <div
          className="lightning-bolt-container"
          onAnimationEnd={() =>
            setShowLightningBolt(
              false
            )
          }
        >

          <svg
            className="lightning-bolt-svg"
            viewBox="0 0 200 800"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >

            <path
              className="main-strike-glow-outer"
              d="M 100 0 L 85 80 L 120 160 L 70 280 L 135 390 L 60 530 L 110 660 L 80 780 L 100 800"
            />

            <path
              className="main-strike-glow-inner"
              d="M 100 0 L 85 80 L 120 160 L 70 280 L 135 390 L 60 530 L 110 660 L 80 780 L 100 800"
            />

            <path
              className="main-strike"
              d="M 100 0 L 85 80 L 120 160 L 70 280 L 135 390 L 60 530 L 110 660 L 80 780 L 100 800"
            />

            <path
              className="branch-strike"
              d="M 120 160 L 150 185 M 120 160 L 140 150 M 70 280 L 30 250 M 70 280 L 45 290 M 135 390 L 175 360 M 60 530 L 20 510 M 60 530 L 40 560 M 110 660 L 155 685 M 110 660 L 135 630 M 80 780 L 40 750"
            />

          </svg>

        </div>
      )}


      {isLightningMode && (
        <div className="lightning-meter-container">

          <div
            className="lightning-meter-fill"
            style={{
              height:
                `${lightningMeter}%`,
            }}
          />

          <span className="lightning-meter-label">
            ⚡
          </span>

        </div>
      )}


      {/* =====================================================
          SONG HUD
      ====================================================== */}

      <div className="song-hud">

        <img
          src={song.thumbnail}
          alt=""
        />


        <div>

          <strong>
            {song.title}
          </strong>

          <span>
            {song.artist}
          </span>


          <div className="time-bar">

            <div
              className="time-progress"
              style={{
                width:
                  `${Math.min(
                    100,
                    (
                      currentTime /
                      (
                        chart.duration ||
                        1
                      )
                    ) *
                      100
                  )}%`,
              }}
            />

          </div>

        </div>

      </div>


      {/* =====================================================
          SCORE BOX
      ====================================================== */}

      <div
        className={`score-box multiplier-${
          multiplier >= 4
            ? 4
            : multiplier
        }`}
      >

        <div className="score-box-header">

          <span className="score-label">
            SCORE
          </span>


          <span className="score-rank">

            <span className="rank-icon">
              💀
            </span>

            <span className="multiplier-value">
              {multiplier}x
            </span>

          </span>

        </div>


        <div className="score-value">
          {score}
        </div>


        <div className="score-progress">

          <div
            className="progress-fill"
            style={{
              width:
                `${(
                  combo %
                  10
                ) *
                  10}%`,
            }}
          />

        </div>


        <div className="combo-row">

          <span className="combo-label">
            COMBO
          </span>


          <span
            className={`combo-number ${
              combo > 0
                ? "combo-pop"
                : ""
            }`}
            key={combo}
          >
            {combo}
          </span>

        </div>

      </div>


      {/* =====================================================
          HIGHWAY
      ====================================================== */}

      <div className="highway">

        <div className="highway-surface">

          {highwayBackgroundUrl && (
            <img
              className="highway-custom-background"
              src={highwayBackgroundUrl}
              alt=""
              draggable="false"
              aria-hidden="true"
              style={{
                opacity: Number(backgroundSettings.highwayOpacity ?? 0.34),
                filter: `brightness(${Math.max(0, 1 - Number(backgroundSettings.highwayDarkness ?? 0.38))})`,
              }}
            />
          )}

          {/* Guias */}

          <svg
            className="lane-guides"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >

            {Array.from({
              length:
                LANES - 1,
            }).map(
              (
                _,
                index
              ) => (
                <line
                  key={index}
                  x1={
                    LANE_GEOMETRY[
                      index
                    ].topRight
                  }
                  y1="0"
                  x2={
                    LANE_GEOMETRY[
                      index
                    ].bottomRight
                  }
                  y2="100"
                />
              )
            )}

          </svg>


          {/* =================================================
              CANVAS
          ================================================== */}

          <canvas
            ref={canvasRef}
            className="gameplay-canvas"
            aria-hidden="true"
            style={{
              pointerEvents:
                "none",

              transform:
                "translate3d(0,0,0)",
            }}
          />


          {/* =================================================
              HIT LINE
          ================================================== */}

          <div className="hit-line">

            {Array.from({
              length:
                LANES,
            }).map(
              (
                _,
                index
              ) => {
                const laneColor =
                  isLightningMode
                    ? "#00ffff"
                    : LANE_COLORS[
                        index
                      ];


                const laneWidth =
                  (
                    LANE_WEIGHTS[
                      index
                    ] /
                    TOTAL_LANE_WEIGHT
                  ) *
                  100;


                let laneLeft =
                  0;


                for (
                  let i = 0;
                  i <
                    index;
                  i++
                ) {
                  laneLeft +=
                    (
                      LANE_WEIGHTS[
                        i
                      ] /
                      TOTAL_LANE_WEIGHT
                    ) *
                    100;
                }


                return (
                  <div
                    key={index}

                    ref={(
                      element
                    ) => {
                      if (
                        element
                      ) {
                        hitPadRefs.current.set(
                          index,
                          element
                        );
                      } else {
                        hitPadRefs.current.delete(
                          index
                        );
                      }
                    }}

                    aria-pressed="false"

                    className="hit-pad"

                    style={{
                      position:
                        "absolute",

                      left:
                        `${laneLeft}%`,

                      width:
                        `${laneWidth}%`,

                      borderColor:
                        laneColor,

                      "--lane-color":
                        laneColor,
                    }}
                  >

                    {/* ==================================
                        FIRE NORMAL
                    =================================== */}

                    <div
                      ref={(
                        element
                      ) => {
                        if (
                          element
                        ) {
                          fireEffectRefs.current.set(
                            index,
                            element
                          );
                        } else {
                          fireEffectRefs.current.delete(
                            index
                          );
                        }
                      }}

                      className="fire-effect"

                      aria-hidden="true"

                      style={{
                        opacity:
                          0,

                        animation:
                          "none",
                      }}
                    >

                      <div className="fire-beam" />

                      <div className="flame-container">

                        <div className="flame flame-1" />

                        <div className="flame flame-2" />

                        <div className="flame flame-3" />

                      </div>

                    </div>


                    {/* ==================================
                        FIRE SUSTAIN
                    =================================== */}

                    <div
                      ref={(
                        element
                      ) => {
                        if (
                          element
                        ) {
                          sustainFireRefs.current.set(
                            index,
                            element
                          );
                        } else {
                          sustainFireRefs.current.delete(
                            index
                          );
                        }
                      }}

                      className="sustain-fire"

                      aria-hidden="true"

                      style={{
                        opacity:
                          0,

                        visibility:
                          "hidden",
                      }}
                    >

                      <div className="sustain-fire-beam" />


                      <div className="sustain-flame-container">

                        <div className="flame sustain-flame-1" />

                        <div className="flame sustain-flame-2" />

                        <div className="flame sustain-flame-3" />

                      </div>


                      <div className="sustain-sparks">

                        <span className="sustain-spark spark-1" />

                        <span className="sustain-spark spark-2" />

                        <span className="sustain-spark spark-3" />

                      </div>

                    </div>


                    {/* ==================================
                        CORE
                    =================================== */}

                    <div
                      className="hit-pad-inner"

                      style={{
                        background:
                          isLightningMode
                            ? "radial-gradient(circle, #00ffff 0%, rgba(0,0,0,0.8) 62%, rgba(0,0,0,0.98) 100%)"
                            : `radial-gradient(circle, ${laneColor} 0%, rgba(0,0,0,0.8) 62%, rgba(0,0,0,0.98) 100%)`,
                      }}
                    />


                    {/* ==================================
                        KEY
                    =================================== */}

                    <div className="key-label">

                      {
                        activeKeys[
                          index
                        ]
                      }

                    </div>

                  </div>
                );
              }
            )}

          </div>

        </div>

      </div>


      {/* =====================================================
          SIDE INFO
      ====================================================== */}

      <div className="game-side-info">

        <div className="bpm-box">

          <span>
            BPM
          </span>

          <strong>
            {(chart.bpm || 0).toFixed(
              0
            )}
          </strong>

        </div>


        <div className="note-counter">

          <span>
            NOTAS
          </span>

          <strong>
            {chart.notes.length}
          </strong>

        </div>


        <div className="note-counter">

          <span>
            ACERTOS
          </span>

          <strong>
            {hitCount}
          </strong>

        </div>


        <div className="note-counter">

          <span>
            ERROS
          </span>

          <strong>
            {missCount}
          </strong>

        </div>

      </div>


      {/* =====================================================
          BACK
      ====================================================== */}

      {!finished &&
        !isPaused && (
          <button
            className="game-back"
            onClick={() => {

              releaseAllKeys();

              setIsPaused(
                true
              );

              setShowPauseMenu(
                true
              );

              videoRef.current?.pause();

              audioRef.current?.pause();

            }}
          >
            ←
          </button>
        )}


      {/* =====================================================
          PAUSE
      ====================================================== */}

      {showPauseMenu && (
        <div className="pause-overlay">

          <div className="pause-modal">

            <h2>
              PAUSA
            </h2>


            <div className="pause-options">

              <button
                className="pause-button"
                onClick={() =>
                  handlePauseMenuAction(
                    "resume"
                  )
                }
              >
                RETOMAR
              </button>


              <button
                className="pause-button"
                onClick={() =>
                  handlePauseMenuAction(
                    "restart"
                  )
                }
              >
                REINICIAR
              </button>


              <button
                className="pause-button"
                onClick={() =>
                  handlePauseMenuAction(
                    "exit"
                  )
                }
              >
                SAIR
              </button>

            </div>

          </div>

        </div>
      )}


      {/* =====================================================
          FINISH
      ====================================================== */}

      {finished && (
        <div className="finish-overlay">

          <div className="finish-modal">

            <img
              src={logoImg}
              alt="Guitar Livre"
              className="finish-logo"
            />


            <h1>
              Música concluída!
            </h1>


            <p>
              Você chegou ao final de{" "}
              <strong>
                {song.title}
              </strong>
              .
            </p>


            <div className="finish-stats">

              <div className="finish-stat success">

                <div className="finish-stat-title">

                  <span className="finish-stat-icon">
                    ✓
                  </span>

                  <span>
                    ACERTOS
                  </span>

                </div>


                <strong>
                  {hitCount}
                </strong>

              </div>


              <div className="finish-stat error">

                <div className="finish-stat-title">

                  <span className="finish-stat-icon">
                    ✕
                  </span>

                  <span>
                    ERROS
                  </span>

                </div>


                <strong>
                  {missCount}
                </strong>

              </div>


              <div className="finish-stat accuracy">

                <div className="finish-stat-title">

                  <span className="finish-stat-icon">
                    🎯
                  </span>

                  <span>
                    PRECISÃO
                  </span>

                </div>


                <strong>

                  {
                    hitCount +
                      missCount >
                    0

                      ? (
                          (
                            hitCount /
                            (
                              hitCount +
                              missCount
                            )
                          ) *
                          100
                        ).toFixed(
                          1
                        )

                      : "0.0"
                  }%

                </strong>

              </div>


              <div className="finish-stat score">

                <div className="finish-stat-title">

                  <span>
                    SCORE
                  </span>

                </div>


                <strong>
                  {score}
                </strong>

              </div>


              <div className="finish-stat max-combo">

                <div className="finish-stat-title">

                  <span>
                    MAX COMBO
                  </span>

                </div>


                <strong>
                  {maxCombo}
                </strong>

              </div>

            </div>


            <button
              onClick={
                onBack
              }
            >
              VOLTAR ÀS MÚSICAS
            </button>

          </div>

        </div>
      )}

    </div>
  );
}


export default Game;