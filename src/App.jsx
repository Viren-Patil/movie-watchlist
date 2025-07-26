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

const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY;
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
  const [gameMovie, setGameMovie] = useState(null);
  const [guess, setGuess] = useState("");
  const [gameResult, setGameResult] = useState("");
  const [showGame, setShowGame] = useState(false);
  const [scrapbookMode, setScrapbookMode] = useState(false);
  const [genreMap, setGenreMap] = useState({});
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [providers, setProviders] = useState([]);
  const [showProvidersModal, setShowProvidersModal] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);



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

  const openMovieModal = (movie) => {
    setSelectedMovie(movie);
    setNoteInputs(prev => ({ ...prev, [movie.id]: movie.note || "" }));
    setDateInputs(prev => ({ ...prev, [movie.id]: movie.watchedDate || "" }));
  };

  const closeMovieModal = () => setSelectedMovie(null);

  const fetchAndShowProviders = async (tmdbId) => {
    try {
      const url = `${TMDB_BASE_URL}/movie/${tmdbId}/watch/providers?api_key=${TMDB_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      const flatrate = data.results?.US?.flatrate || [];
      setProviders(flatrate);
      setShowProvidersModal(true);
    } catch (err) {
      console.error("Error fetching providers:", err);
      alert("Couldn't fetch streaming info.");
    }
  };

  const startGuessGame = () => {
    const watchedMovies = movies.filter((m) => m.watched && m.poster);
    if (watchedMovies.length === 0) return alert("No watched movies with posters!");

    const random = watchedMovies[Math.floor(Math.random() * watchedMovies.length)];
    setGameMovie(random);
    setGuess("");
    setGameResult("");
    setShowGame(true);
  };

  useEffect(() => {
    const q = query(movieRef, orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMovies(data);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    async function loadGenres() {
      try {
        const res = await fetch(`${TMDB_BASE_URL}/genre/movie/list?api_key=${TMDB_API_KEY}`);
        const data = await res.json();
        const map = {};
        data.genres.forEach(g => map[g.id] = g.name);
        setGenreMap(map);
      } catch (err) {
        console.error("Failed to fetch genre list", err);
      }
    }
    loadGenres();
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

  const genreSet = new Set();

  movies.forEach((movie) => {
    if (movie.genre) {
      movie.genre
        .split(",")
        .map((g) => g.trim())
        .forEach((g) => genreSet.add(g));
    }
  });

  const uniqueGenres = Array.from(genreSet);


  const filteredMovies = movies.filter((movie) => {
    const matchesStatus =
      filter === "watched" ? movie.watched :
      filter === "unwatched" ? !movie.watched :
      filter === "wishlist" ? movie.wishlist :
      true;

    const matchesGenre =
      genreFilter === "all" ||
      (movie.genre && movie.genre.split(",").some(g => g.trim() === genreFilter));
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

  const totalMovies = movies.length;
  const watchedMovies = movies.filter((m) => m.watched).length;
  const overallProgress = totalMovies ? (watchedMovies / totalMovies) * 100 : 0;


  return (
    <div className="container">
      <div className="guess-game-wrapper">
        <button className="guess-game-btn" onClick={startGuessGame}>
          <i className="fas fa-gamepad"></i>
        </button>
      </div>
      <h1 className="title">Aditi & Viren's Movie WatchList 💕</h1>
      <div className="input-group">
        <input
          type="text"
          placeholder="Search movie title"
          value={newMovie}
          onChange={(e) => setNewMovie(e.target.value)}
        />
        <button
          onClick={async () => {
            if (!newMovie.trim()) return;
            const res = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(newMovie.trim())}`);
            const data = await res.json();
            setSearchResults(data.results || []);
            setShowSearchModal(true);
          }}
          title="Search Movies"
        >
          <i className="fas fa-search"></i>
        </button>
      </div>

      {totalMovies > 0 && (
        <div className="overall-progress-container">
          <div className="overall-progress-label">
            Watched {watchedMovies} / {totalMovies} movies
          </div>
          <div className="overall-progress-bar">
            <div
              className="overall-progress-fill"
              style={{ width: `${overallProgress}%` }}
            ></div>
          </div>
        </div>
      )}

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
        
      <div className="scrapbook-grid">
        {sortedMovies.map((movie) => (
          <div
            key={movie.id}
            className="poster-tile"
            onClick={() => openMovieModal(movie)}
          >
            {movie.poster && (
              <img
                src={movie.poster}
                alt={movie.title}
                className="poster-img"
              />
            )}
            <div className="poster-hover">
              <strong>{movie.title}</strong>
              {movie.releaseYear && <p>{movie.releaseYear}</p>}
              {movie.genre && <p>{movie.genre}</p>}
              {movie.rating > 0 && <p>⭐ {movie.rating}/5</p>}
              {movie.watchedDate && <p>{movie.watchedDate} 👁️</p>}
            </div>
          </div>
        ))}
      </div>

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

      {showGame && gameMovie && (
        <div className="game-modal" onClick={() => setShowGame(false)}>
          <div className="game-content" onClick={(e) => e.stopPropagation()}>
            <h3>Guess the Movie</h3>
            <img
              src={gameMovie.poster}
              alt="Guess this movie"
              className={`game-poster ${gameResult === "correct" ? "unblurred" : "blurred"}`}
            />
            <input
              type="text"
              placeholder="Your guess..."
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              className="guess-input"
            />
            <button className="guess-submit-btn"
              onClick={() => {
                const isCorrect = guess.trim().toLowerCase() === gameMovie.title.toLowerCase();
                setGameResult(isCorrect ? "correct" : "wrong");
              }}
            >
              Submit
            </button>
            {gameResult && (
              <p className={gameResult === "correct" ? "correct-msg" : "wrong-msg"}>
                {gameResult === "correct" ? "🎉 Correct!" : "❌ Try again!"}
              </p>
            )}
            <button onClick={() => startGuessGame()} className="guess-submit-btn">New Poster</button>
            <button onClick={() => setShowGame(false)} className="guess-close-btn">Close</button>
          </div>
        </div>
      )}

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

      {showSearchModal && (
        <div className="movie-select-modal" onClick={() => setShowSearchModal(false)}>
          <div className="movie-select-content" onClick={(e) => e.stopPropagation()}>
            <h3>Select a Movie</h3>
            {searchResults.length > 0 ? (
              <div className="scrapbook-grid">
                {searchResults.map((movie) => (
                  <div key={movie.id} className="poster-tile" onClick={async () => {
                    const genreNames = (movie.genre_ids || [])
                      .map(id => genreMap[id])
                      .filter(Boolean)
                      .join(", ");

                    await addDoc(movieRef, {
                      title: movie.title,
                      genre: genreNames,
                      releaseYear: movie.release_date?.split("-")[0] || "",
                      poster: movie.poster_path
                        ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
                        : null,
                      tmdbId: movie.id,
                      watched: false,
                      createdAt: new Date(),
                      rating: 0,
                      note: "",
                      watchedDate: "",
                      wishlist: false
                    });

                    setShowSearchModal(false);
                    setNewMovie("");
                    setSearchResults([]);
                  }}>
                    {movie.poster_path ? (
                      <img
                        src={`${TMDB_IMAGE_BASE}${movie.poster_path}`}
                        alt={movie.title}
                        className="poster-img"
                      />
                    ) : (
                      <div className="poster-img" style={{ background: "#999", height: "180px" }}>No Image</div>
                    )}
                    <div className="poster-hover">
                      <strong>{movie.title}</strong>
                      {movie.release_date && (
                        <p>{movie.release_date.split("-")[0]}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ textAlign: "center", margin: "2rem 0", color: "#ccc" }}>
                No results found.
              </p>
            )}

            <button className="guess-close-btn" onClick={() => setShowSearchModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {showProvidersModal && (
        <div className="show-provider-modal" onClick={() => setShowProvidersModal(false)}>
          <div className="show-provider-content" onClick={(e) => e.stopPropagation()}>
            <h3>Available On</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center", padding: "1rem 0" }}>
              {providers.length > 0 ? (
                providers.map(p => (
                  <div key={p.provider_name} style={{ textAlign: "center" }}>
                    <img
                      src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                      alt={p.provider_name}
                      title={p.provider_name}
                      style={{ height: "50px" }}
                    />
                    <div style={{ color: "#ccc", fontSize: "0.85rem" }}>{p.provider_name}</div>
                  </div>
                ))
              ) : (
                <p style={{ color: "#ccc" }}>Not available on major platforms.</p>
              )}
            </div>
            <button className="guess-close-btn" onClick={() => setShowProvidersModal(false)}>Close</button>
          </div>
        </div>
      )}

      {selectedMovie && (
        <div className="movie-select-modal" onClick={closeMovieModal}>
          <div className="movie-select-content" onClick={(e) => e.stopPropagation()}>
            <h3>{selectedMovie.title} ({selectedMovie.releaseYear})</h3>

            {selectedMovie.poster && (
              <img
                src={selectedMovie.poster}
                alt={selectedMovie.title}
                className="poster-img"
                style={{ maxWidth: "180px", margin: "0 auto", borderRadius: "8px" }}
              />
            )}

            <div className="genre-releaseyear">
              {selectedMovie.genre && <p style={{ marginTop: "0.5rem" }}>{selectedMovie.genre}</p>}
            </div>

            <div className="modal-btn-group">
              <button onClick={() => openTrailer(selectedMovie.title)} title="Watch Trailer">
                <i className="fas fa-film"></i>
              </button>
              <button
                onClick={() => {
                  const newWishlist = !selectedMovie.wishlist;
                  toggleWishlist(selectedMovie.id, selectedMovie.wishlist);
                  setSelectedMovie(prev => ({ ...prev, wishlist: newWishlist }));
                }}
                title={selectedMovie.wishlist ? "Remove from Wishlist" : "Add to Wishlist"}
              >
                <i className="fas fa-heart" style={{ color: selectedMovie.wishlist ? "deeppink" : "lightgray" }}></i>
              </button>
              <button onClick={() => {
                toggleWatched(selectedMovie.id, selectedMovie.watched);
                setSelectedMovie(prev => ({ ...prev, watched: !prev.watched }));
              }} title={selectedMovie.watched ? "Mark as Unwatched" : "Mark as Watched"}>
                <i className={`fas ${selectedMovie.watched ? "fa-eye" : "fa-eye-slash"}`}></i>
              </button>
              <button onClick={() => {
                removeMovie(selectedMovie.id);
                closeMovieModal();
              }} title="Delete Movie">
                <i className="fas fa-trash-alt" style={{ color: "crimson" }}></i>
              </button>
              <button onClick={() => fetchAndShowProviders(selectedMovie.tmdbId)} title="Where to Watch">
                <i className="fas fa-tv"></i>
              </button>
            </div>

            {selectedMovie.watched && (
              <div style={{ marginTop: "1rem" }}>
                <div className="watched-meta-center">
                  <label style={{ marginBottom: "0.3rem" }}>Watched On:</label>
                  <input
                    type="date"
                    value={dateInputs[selectedMovie.id] || new Date().toISOString().split("T")[0]}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDateInputs({ ...dateInputs, [selectedMovie.id]: val });
                      updateWatchedDate(selectedMovie.id, val);
                    }}
                    className="watched-date-picker"
                    style={{ marginLeft: "0.5rem" }}
                  />

                  <div className="rating-stars" style={{ marginTop: "0.5rem" }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i
                        key={star}
                        className={`fa-star ${star <= selectedMovie.rating ? "fas" : "far"}`}
                        onClick={() => {
                          updateRating(selectedMovie.id, star);
                          setSelectedMovie({ ...selectedMovie, rating: star });
                        }}
                        title={`Rate ${star} star${star > 1 ? "s" : ""}`}
                      ></i>
                    ))}
                  </div>
                </div>

                <details open style={{ marginTop: "1rem", textAlign: "left" }}>
                  <summary>Review / Notes</summary>
                  <textarea
                    rows="3"
                    value={noteInputs[selectedMovie.id] ?? ""}
                    onChange={(e) =>
                      setNoteInputs({ ...noteInputs, [selectedMovie.id]: e.target.value })
                    }
                    onBlur={() =>
                      updateNote(selectedMovie.id, noteInputs[selectedMovie.id])
                    }
                    className="note-textarea"
                    placeholder="Add your note here..."
                    style={{ width: "100%", marginTop: "0.5rem" }}
                  ></textarea>
                </details>
              </div>
            )}


            <button onClick={closeMovieModal} className="guess-close-btn" style={{ marginTop: "1rem" }}>
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
