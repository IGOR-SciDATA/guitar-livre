import { useState } from "react";
import SongLibrary from "../components/SongLibrary";
import Game from "../components/Game";

function Play({ onBack }) {
  const [selectedSong, setSelectedSong] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState(null);

  const handlePlaySong = (song, difficulty) => {
    setSelectedSong(song);
    setSelectedDifficulty(difficulty);
  };

  if (selectedSong && selectedDifficulty) {
    return (
      <Game
        song={selectedSong}
        difficulty={selectedDifficulty}
        onBack={() => {
          setSelectedSong(null);
          setSelectedDifficulty(null);
        }}
      />
    );
  }

  return (
    <SongLibrary
      onBack={onBack}
      onPlaySong={handlePlaySong}
    />
  );
}

export default Play;