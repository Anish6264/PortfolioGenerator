import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Professions from "./pages/Professions";
import Templates from "./pages/Templates";
import TemplatePreview from "./pages/TemplatePreview";

import Login from "./pages/Login";
import Signup from "./pages/Signup";

import Builder from "./pages/Builder";
import Dashboard from "./pages/Dashboard";

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
                    element={<Builder />}
                />


                {/* Portfolio Builder - Edit */}

                <Route
                    path="/builder/edit/:id"
                    element={<Builder />}
                />


                {/* Dashboard */}

                <Route
                    path="/dashboard"
                    element={<Dashboard />}
                />

            </Routes>

        </BrowserRouter>
    );
}

export default App;