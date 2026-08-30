import API_URL from "../config";
import { useEffect, useMemo, useState } from "react";
import "./SongLibrary.css";
import { useAuth } from "../contexts/AuthContext";

function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return "00:00";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function SongLibrary({ onBack, onPlaySong }) {
  const { user } = useAuth();
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [userScore, setUserScore] = useState(0);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const response = await fetch(`${API_URL}/api/songs`);
        if (!response.ok) {
          throw new Error("Falha ao carregar músicas");
        }
        const data = await response.json();
        const readySongs = data.filter((song) => song.ready);
        setSongs(readySongs);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSongs();
  }, []);

  const groupedSongs = useMemo(() => {
    const sorted = [...songs].sort((a, b) => {
      const artistComparison = a.artist.localeCompare(b.artist);
      if (artistComparison !== 0) return artistComparison;
      return a.title.localeCompare(b.title);
    });

    return sorted.reduce((groups, song) => {
      if (!groups[song.artist]) {
        groups[song.artist] = [];
      }
      groups[song.artist].push(song);
      return groups;
    }, {});
  }, [songs]);

  // --- Processa o ranking para garantir apenas a MAIOR pontuação por usuário ---
  const processedRanking = useMemo(() => {
    if (!ranking || ranking.length === 0) return [];

    const bestScoresMap = {};
    ranking.forEach((entry) => {
      if (!bestScoresMap[entry.username] || entry.score > bestScoresMap[entry.username].score) {
        bestScoresMap[entry.username] = entry;
      }
    });

    return Object.values(bestScoresMap).sort((a, b) => b.score - a.score);
  }, [ranking]);

  const fetchRanking = async (songId) => {
    try {
      const response = await fetch(`${API_URL}/api/rankings/${songId}`);
      if (!response.ok) return;
      const data = await response.json();
      setRanking(data);
    } catch (err) {
      console.error("Erro ao buscar ranking:", err);
    }
  };

  const fetchUserScore = async (songId, username) => {
    try {
      const response = await fetch(
        `${API_URL}/api/rankings/${songId}/user/${username}`
      );
      if (!response.ok) {
        setUserScore(0);
        return;
      }
      const data = await response.json();
      setUserScore(data.score || 0);
    } catch (err) {
      console.error("Erro ao buscar pontuação do usuário:", err);
      setUserScore(0);
    }
  };

  const handleSongClick = (song) => {
    setSelectedSong(song);
    setShowDifficulty(false);
    setSelectedDifficulty(null);
    fetchRanking(song.id);
    if (user) {
      fetchUserScore(song.id, user.username);
    } else {
      setUserScore(0);
    }
  };

  const handlePlayClick = () => {
    setShowDifficulty(true);
    setSelectedDifficulty(null);
  };

  const handleDifficultySelect = (difficulty) => {
    setSelectedDifficulty(difficulty);
  };

  const handleStartGame = () => {
    if (selectedSong && selectedDifficulty) {
      onPlaySong(selectedSong, selectedDifficulty);
    }
  };

  return (
    <div className="song-library-page">
      <div className="song-library-background" />

      <header className="play-header">
        <button className="back-button" onClick={onBack}>
          ←
        </button>
        <div>
          <span className="page-label">GUITAR LIVRE</span>
          <h1>Setlist</h1>
        </div>
      </header>

      <div className="song-library-content">
        <section className="song-list-panel">
          {loading ? (
            <p className="panel-placeholder">Carregando músicas...</p>
          ) : error ? (
            <p className="panel-placeholder">Erro: {error}</p>
          ) : Object.keys(groupedSongs).length === 0 ? (
            <p className="panel-placeholder">Nenhuma música pronta encontrada.</p>
          ) : (
            <ul className="song-list">
              {Object.entries(groupedSongs).map(([artist, artistSongs]) => (
                <li className="artist-group" key={artist}>
                  <h2 className="artist-name">{artist}</h2>
                  <ul className="artist-songs">
                    {artistSongs.map((song) => (
                      <li key={song.id}>
                        <button
                          className={`song-item ${
                            selectedSong?.id === song.id ? "selected" : ""
                          }`}
                          onClick={() => handleSongClick(song)}
                        >
                          <span className="song-title">{song.title}</span>
                          <span className="song-artist">{song.artist}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="song-mural">
          {selectedSong ? (
            <>
              <div className="mural-image-container">
                <img
                  className="mural-thumbnail"
                  src={selectedSong.thumbnail}
                  alt={selectedSong.title}
                />
              </div>
              <div className="mural-info">
                <span className="mural-clock">🕒 {formatDuration(selectedSong.duration)}</span>
                <span className="mural-score">
                  🏆 {userScore > 0 ? userScore.toLocaleString() : "0000"}
                </span>
              </div>

              {/* Ranking rolável, destacando os três primeiros */}
              {!showDifficulty && processedRanking.length > 0 && (
                <div className="mural-ranking">
                  <h4 className="ranking-title">🏆 RANKING</h4>
                  <ul className="ranking-list">
                    {processedRanking.map((entry, index) => {
                      let medalClass = '';
                      let icon = '';
                      if (index === 0) { medalClass = 'place-1'; icon = '🥇'; }
                      else if (index === 1) { medalClass = 'place-2'; icon = '🥈'; }
                      else if (index === 2) { medalClass = 'place-3'; icon = '🥉'; }
                      else { icon = `#${index + 1}`; }

                      return (
                        <li key={index} className={`ranking-item ${medalClass}`}>
                          <span className="ranking-position">{icon}</span>
                          <span className="ranking-user">{entry.username}</span>
                          <span className="ranking-score">
                            {entry.score.toLocaleString()}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {!showDifficulty ? (
                <button className="mural-play-button" onClick={handlePlayClick}>
                  JOGAR
                </button>
              ) : (
                <div className="mural-difficulty">
                  <h3>Escolha a dificuldade</h3>
                  <div className="difficulty-buttons">
                    {selectedSong.difficulties?.map((diff) => (
                      <button
                        key={diff}
                        className={`difficulty-button ${
                          selectedDifficulty === diff ? "selected" : ""
                        }`}
                        onClick={() => handleDifficultySelect(diff)}
                      >
                        {diff.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button
                    className="mural-start-button"
                    onClick={handleStartGame}
                    disabled={!selectedDifficulty}
                  >
                    INICIAR
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="mural-empty">
              <span>🎵</span>
              <p>Selecione uma música</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default SongLibrary;