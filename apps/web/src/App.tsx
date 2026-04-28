import {BrowserRouter, Route, Routes} from "react-router-dom";
import {HomePage} from "./pages/HomePage";
import {CreatePage} from "./pages/CreatePage";
import {TipPage} from "./pages/TipPage";
import {EditProfilePage} from "./pages/EditProfilePage";
import {DashboardPage} from "./pages/DashboardPage";
import {OverlayPage} from "./pages/OverlayPage";
import {ExplorePage} from "./pages/ExplorePage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/create" element={<CreatePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/s/:handle" element={<TipPage />} />
        <Route path="/s/:handle/edit" element={<EditProfilePage />} />
        <Route path="/overlay/:handle" element={<OverlayPage />} />
      </Routes>
    </BrowserRouter>
  );
}
