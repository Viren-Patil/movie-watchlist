import confetti from "canvas-confetti";
import { useState, useEffect } from "react";
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

const TMDB_API_KEY = "25de9489980ba604df19fc1bdb818beb";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w200";

async function fetchTrailer(title) {
  const searchUrl = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}`;
  try {
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const movieId = searchData.results?.[0]?.id;
    if (!movieId) return null;

    const videoUrl = `${TMDB_BASE_URL}/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`;
    const videoRes = await fetch(videoUrl);
    const videoData = await videoRes.json();
    const trailer = videoData.results.find(v => v.type === "Trailer" && v.site === "YouTube");
    return trailer ? `https://www.youtube.com/embed/${trailer.key}` : null;
  } catch (err) {
    console.error("Error fetching trailer:", err);
    return null;
  }
}

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
  const [noteInputs, setNoteInputs] = useState({});
  const [dateInputs, setDateInputs] = useState({});
  const [sortOption, setSortOption] = useState("date-desc");
  const [trailerUrl, setTrailerUrl] = useState(null);


  const movieRef = collection(db, "movies");

  const openTrailer = async (title) => {
    const url = await fetchTrailer(title);
    if (url) {
      setTrailerUrl(url);
    } else {
      alert("Trailer not found.");
    }
  };

  const closeTrailer = () => {
    setTrailerUrl(null);
  };


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
      rating: 0,
      note: "",
      watchedDate: "",
      wishlist: false
    });
    setNewMovie("");
    setGenre("");
  };

  const toggleWatched = async (id, watched) => {
    const ref = doc(db, "movies", id);
    const newWatched = !watched;
    const watchedDate = newWatched ? (dateInputs[id] || new Date().toISOString().split("T")[0]) : "";
    await updateDoc(ref, {
      watched: newWatched,
      rating: newWatched ? 0 : 0,
      note: newWatched ? "" : "",
      watchedDate
    });

    if (newWatched) {
      confetti({
        particleCount: 60,
        angle: 45,
        spread: 60,
        origin: { x: 0, y: 1 }
      });

      confetti({
        particleCount: 60,
        angle: 135,
        spread: 60,
        origin: { x: 1, y: 1 }
      });
    }
  };

  const toggleWishlist = async (id, currentState) => {
    const ref = doc(db, "movies", id);
    await updateDoc(ref, { wishlist: !currentState });
  };

  const updateRating = async (id, rating) => {
    const ref = doc(db, "movies", id);
    await updateDoc(ref, { rating });
  };

  const updateNote = async (id, note) => {
    const ref = doc(db, "movies", id);
    await updateDoc(ref, { note });
  };

  const updateWatchedDate = async (id, date) => {
    const ref = doc(db, "movies", id);
    await updateDoc(ref, { watchedDate: date });
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
      filter === "watched" ? movie.watched :
      filter === "unwatched" ? !movie.watched :
      filter === "wishlist" ? movie.wishlist :
      true;

    const matchesGenre = genreFilter === "all" || movie.genre === genreFilter;
    const matchesSearch = movie.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesGenre && matchesSearch;
  });

  const sortedMovies = [...filteredMovies].sort((a, b) => {
    switch (sortOption) {
      case "title-asc":
        return a.title.localeCompare(b.title);
      case "title-desc":
        return b.title.localeCompare(a.title);
      case "date-asc":
        return new Date(a.createdAt?.toDate?.() ?? a.createdAt) - new Date(b.createdAt?.toDate?.() ?? b.createdAt);
      case "date-desc":
      default:
        return new Date(b.createdAt?.toDate?.() ?? b.createdAt) - new Date(a.createdAt?.toDate?.() ?? a.createdAt);
    }
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
        <label>Filter:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="unwatched">Unwatched</option>
          <option value="watched">Watched</option>
          <option value="wishlist">Wishlist</option>
        </select>

        <label>Genre:</label>
        <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
          <option value="all">All</option>
          {uniqueGenres.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        <label>Sort by:</label>
        <select value={sortOption} onChange={(e) => setSortOption(e.target.value)}>
          <option value="title-asc">Title (A–Z)</option>
          <option value="title-desc">Title (Z–A)</option>
          <option value="date-asc">Date Added (Oldest)</option>
          <option value="date-desc">Date Added (Newest)</option>
        </select>
      </div>

      <div className="search-wrapper">
        <i className="fas fa-search search-icon"></i>
        <input
          type="text"
          placeholder="Search by title"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-bar"
        />
      </div>

      <ul className="movie-list">
        {sortedMovies.map((movie) => (
          <li key={movie.id} className="movie-item">
            <div className="movie-details">
              {movie.poster && <img src={movie.poster} alt={`${movie.title} poster`} className="poster" />}
              <div>
                <strong>{movie.title}</strong>{" "}
                {movie.genre && <em>({movie.genre})</em>}
                {movie.watched && " ✅"}
                {movie.watched && (
                  <div className="watched-date">
                    Watched on:
                    <input
                      type="date"
                      value={movie.watchedDate || new Date().toISOString().split("T")[0]}
                      max={new Date().toISOString().split("T")[0]}
                      onChange={(e) => {
                        setDateInputs({ ...dateInputs, [movie.id]: e.target.value });
                        updateWatchedDate(movie.id, e.target.value);
                      }}
                      className="watched-date-picker"
                    />
                  </div>
                )}
                {movie.watched && (
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i
                        key={star}
                        className={`fa-star ${star <= movie.rating ? "fas" : "far"}`}
                        onClick={() => updateRating(movie.id, star)}
                        title={`Rate ${star} star${star > 1 ? "s" : ""}`}
                      ></i>
                    ))}
                  </div>
                )}
                {movie.watched && (
                  <details>
                    <summary className="note-summary">
                      Notes / Review
                    </summary>
                    <textarea
                      rows="2"
                      value={noteInputs[movie.id] ?? movie.note ?? ""}
                      onChange={(e) => setNoteInputs({ ...noteInputs, [movie.id]: e.target.value })}
                      onBlur={() => updateNote(movie.id, noteInputs[movie.id] ?? "")}
                      className="note-textarea"
                      placeholder="Add your note here..."
                    ></textarea>
                  </details>
                )}
              </div>
            </div>
            <div className="btn-group">
              <button onClick={() => openTrailer(movie.title)} title="Watch Trailer">
                <i className="fas fa-film"></i>
              </button>
              <button onClick={() => toggleWishlist(movie.id, movie.wishlist)} title={movie.wishlist ? "Remove from Wishlist" : "Add to Wishlist"}>
                <i className={`fas fa-heart`} style={{ color: movie.wishlist ? "deeppink" : "lightgray" }}></i>
              </button>
              <button onClick={() => toggleWatched(movie.id, movie.watched)} title={movie.watched ? "Mark as Unwatched" : "Mark as Watched"}>
                <i className={`fas ${movie.watched ? "fa-eye" : "fa-eye-slash"}`}></i>
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

      {trailerUrl && (
        <div className="trailer-modal" onClick={closeTrailer}>
          <div className="trailer-content" onClick={e => e.stopPropagation()}>
            <iframe
              src={trailerUrl}
              width="100%"
              height="400"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Movie Trailer"
            ></iframe>
            <button onClick={closeTrailer} className="close-trailer-btn">Close</button>
          </div>
        </div>
      )}

    </div>
  );
}
