import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Professions from "./pages/Professions";
import Templates from "./pages/Templates";
import TemplatePreview from "./pages/TemplatePreview";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

import Builder from "./pages/Builder";
import Dashboard from "./pages/Dashboard";
import PortfolioPreview from "./pages/PortfolioPreview";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicPortfolio from "./pages/PublicPortfolio";
import Profile from "./pages/Profile";


function App() {

    return (
        <BrowserRouter>

            <Routes>

                {/* Home */}
                <Route
                    path="/"
                    element={<Home />}
                />


                {/* Profession Selection */}
                <Route
                    path="/professions"
                    element={<Professions />}
                />


                {/* Templates */}
                <Route
                    path="/templates"
                    element={<Templates />}
                />

                <Route
                    path="/templates/:id"
                    element={<TemplatePreview />}
                />

                <Route path="/p/:slug" element={<PublicPortfolio />} />


                {/* Authentication */}
                <Route
                    path="/login"
                    element={<Login />}
                />

                <Route
                    path="/signup"
                    element={<Signup />}
                />


                {/* Portfolio Builder - Create */}
                <Route
                    path="/builder"
                    element={<ProtectedRoute><Builder /></ProtectedRoute>}
                />


                {/* Portfolio Builder - Edit */}
                <Route
                    path="/builder/edit/:id"
                    element={<ProtectedRoute><Builder /></ProtectedRoute>}
                />


                {/* Portfolio Preview */}
                <Route
                    path="/portfolio-preview/:id"
                    element={<ProtectedRoute><PortfolioPreview /></ProtectedRoute>}
                />


                {/* Dashboard */}
                <Route
                    path="/dashboard"
                    element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
                />

                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

            </Routes>

        </BrowserRouter>
    );
}

export default App;
