import { useState, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { db } from "./firebase";

import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  orderBy
} from "firebase/firestore";
import "./App.css";

const TMDB_API_KEY = "25de9489980ba604df19fc1bdb818beb"; // optional: you can fill this again later
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w200";

async function fetchPoster(title) {
  const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const posterPath = data.results?.[0]?.poster_path;
    return posterPath ? `${TMDB_IMAGE_BASE}${posterPath}` : null;
  } catch (error) {
    console.error("Error fetching poster:", error);
    return null;
  }
}

export default function MovieWatchlist() {
  const [movies, setMovies] = useState([]);
  const [newMovie, setNewMovie] = useState("");
  const [genre, setGenre] = useState("");
  const [filter, setFilter] = useState("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const movieRef = collection(db, "movies");

  useEffect(() => {
    const q = query(movieRef, orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMovies(data);
    });
    return () => unsubscribe();
  }, []);

  const addMovie = async () => {
    if (newMovie.trim() === "") return;
    const poster = await fetchPoster(newMovie.trim());
    await addDoc(movieRef, {
      title: newMovie.trim(),
      genre: genre.trim(),
      watched: false,
      poster: poster || null,
      createdAt: new Date(),
    });
    setNewMovie("");
    setGenre("");
  };

  const toggleWatched = async (id, watched) => {
    const ref = doc(db, "movies", id);
    await updateDoc(ref, { watched: !watched });
  };

  const removeMovie = async (id) => {
    const ref = doc(db, "movies", id);
    await deleteDoc(ref);
  };

  const clearAll = async () => {
    if (confirm("Are you sure you want to clear the entire list?")) {
      const snapshot = await getDocs(movieRef);
      const deletions = snapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletions);
    }
  };

  const uniqueGenres = Array.from(new Set(movies.map((m) => m.genre).filter(Boolean)));

  const filteredMovies = movies.filter((movie) => {
    const matchesStatus =
      filter === "watched" ? movie.watched : filter === "unwatched" ? !movie.watched : true;
    const matchesGenre = genreFilter === "all" || movie.genre === genreFilter;
    const matchesSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesGenre && matchesSearch;
  });

  return (
    <div className="container">
      <h1 className="title">Aditi & Viren's Movie WatchList 💕</h1>

      <div className="input-group">
        <input
          type="text"
          placeholder="Movie title"
          value={newMovie}
          onChange={(e) => setNewMovie(e.target.value)}
        />
        <input
          type="text"
          placeholder="Genre (optional)"
          value={genre}
          onChange={(e) => setGenre(e.target.value)}
        />
        <button onClick={addMovie}>Add to list</button>
      </div>

      <div className="filter-group">
        <input
          type="text"
          placeholder="Search by title"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-bar"
        />
        <label>Status:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="unwatched">Unwatched</option>
          <option value="watched">Watched</option>
        </select>

        <label>Genre:</label>
        <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
          <option value="all">All</option>
          {uniqueGenres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <button onClick={clearAll}>Clear All</button>

      <ul className="movie-list">
        {filteredMovies.map((movie) => (
          <li key={movie.id} className="movie-item">
            <div className="movie-details">
              {movie.poster && <img src={movie.poster} alt={`${movie.title} poster`} className="poster" />}
              <div>
                <strong>{movie.title}</strong>{" "}
                {movie.genre && <em>({movie.genre})</em>}
                {movie.watched && " ✅"}
              </div>
            </div>
            <div className="btn-group">
              <button onClick={() => toggleWatched(movie.id, movie.watched)}>
                {movie.watched ? "Unwatch" : "Watched"}
              </button>
              <button onClick={() => removeMovie(movie.id)} className="trash-icon" title="Delete Movie">
                <i className="fas fa-trash-alt"></i>
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="secret-wrapper">
        <span className="secret-trigger" onClick={() => setShowSecret(!showSecret)}>
          💕
        </span>
        {showSecret && (
          <p className="secret-message">
            No matter what movie we pick, every moment with you is my favorite scene.
          </p>
        )}
      </div>
    </div>
  );
}
