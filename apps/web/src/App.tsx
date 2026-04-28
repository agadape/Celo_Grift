import {BrowserRouter, Route, Routes, useLocation} from "react-router-dom";
import {HomePage} from "./pages/HomePage";
import {CreatePage} from "./pages/CreatePage";
import {TipPage} from "./pages/TipPage";
import {EditProfilePage} from "./pages/EditProfilePage";
import {DashboardPage} from "./pages/DashboardPage";
import {OverlayPage} from "./pages/OverlayPage";
import {ExplorePage} from "./pages/ExplorePage";
import {LeaderboardPage} from "./pages/LeaderboardPage";
import {NavBar} from "./components/NavBar";

function Layout() {
  const {pathname} = useLocation();
  const hideNav = pathname.startsWith("/overlay");
  return (
    <>
      {!hideNav && <NavBar />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/s/:handle" element={<TipPage />} />
        <Route path="/s/:handle/edit" element={<EditProfilePage />} />
        <Route path="/overlay/:handle" element={<OverlayPage />} />
      </Routes>
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
