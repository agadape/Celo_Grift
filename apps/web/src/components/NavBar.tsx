import {NavLink} from "react-router-dom";

export function NavBar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar-brand">
        <svg width="22" height="22" viewBox="0 0 52 52" fill="none" aria-hidden="true">
          <circle cx="26" cy="26" r="26" fill="#35d07f" />
          <circle cx="26" cy="26" r="14" stroke="#fff" strokeWidth="4" fill="none" />
          <circle cx="26" cy="13" r="5" fill="#fff" />
          <circle cx="36.6" cy="33" r="5" fill="#fff" />
        </svg>
        <span>SawerLink</span>
      </NavLink>

      <div className="navbar-links">
        <NavLink to="/explore" className={({isActive}) => isActive ? "navbar-link active" : "navbar-link"}>
          Explore
        </NavLink>
        <NavLink to="/leaderboard" className={({isActive}) => isActive ? "navbar-link active" : "navbar-link"}>
          Leaderboard
        </NavLink>
        <NavLink to="/dashboard" className={({isActive}) => isActive ? "navbar-link navbar-link--cta active" : "navbar-link navbar-link--cta"}>
          Dashboard
        </NavLink>
      </div>
    </nav>
  );
}
