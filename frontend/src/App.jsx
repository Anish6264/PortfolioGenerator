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
import AdminTemplates from "./pages/AdminTemplates";
import AdminTemplateEdit from "./pages/AdminTemplateEdit";
import AdminRoute from "./components/AdminRoute";
import BuyCredits from "./pages/BuyCredits";
import CreditsBilling from "./pages/CreditsBilling";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminUserDetails from "./pages/AdminUserDetails";
import AdminPayments from "./pages/AdminPayments";
import AdminPaymentDetails from "./pages/AdminPaymentDetails";
import AdminCreditTransactions from "./pages/AdminCreditTransactions";
import AdminCreditTransactionDetails from "./pages/AdminCreditTransactionDetails";
import AdminPortfolios from "./pages/AdminPortfolios";
import AdminPortfolioDetails from "./pages/AdminPortfolioDetails";


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
                    path="/portfolio/:id/preview"
                    element={<ProtectedRoute><PortfolioPreview /></ProtectedRoute>}
                />

                {/* Keep existing private preview links working. */}
                <Route
                    path="/portfolio-preview/:id"
                    element={<ProtectedRoute><PortfolioPreview /></ProtectedRoute>}
                />


                {/* Dashboard */}
                <Route
                    path="/dashboard"
                    element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
                />

                <Route
                    path="/buy-credits"
                    element={<ProtectedRoute><BuyCredits /></ProtectedRoute>}
                />
                <Route
                    path="/credits"
                    element={<ProtectedRoute><CreditsBilling /></ProtectedRoute>}
                />

                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

                <Route
                    path="/admin"
                    element={<AdminRoute><AdminDashboard /></AdminRoute>}
                />
                <Route
                    path="/admin/users"
                    element={<AdminRoute><AdminUsers /></AdminRoute>}
                />
                <Route
                    path="/admin/users/:id"
                    element={<AdminRoute><AdminUserDetails /></AdminRoute>}
                />
                <Route
                    path="/admin/payments"
                    element={<AdminRoute><AdminPayments /></AdminRoute>}
                />
                <Route
                    path="/admin/payments/:id"
                    element={<AdminRoute><AdminPaymentDetails /></AdminRoute>}
                />
                <Route
                    path="/admin/credit-transactions"
                    element={<AdminRoute><AdminCreditTransactions /></AdminRoute>}
                />
                <Route
                    path="/admin/credit-transactions/:id"
                    element={<AdminRoute><AdminCreditTransactionDetails /></AdminRoute>}
                />
                <Route
                    path="/admin/portfolios"
                    element={<AdminRoute><AdminPortfolios /></AdminRoute>}
                />
                <Route
                    path="/admin/portfolios/:id"
                    element={<AdminRoute><AdminPortfolioDetails /></AdminRoute>}
                />
                <Route
                    path="/admin/templates"
                    element={<AdminRoute><AdminTemplates /></AdminRoute>}
                />
                <Route
                    path="/admin/templates/:id/edit"
                    element={<AdminRoute><AdminTemplateEdit /></AdminRoute>}
                />

            </Routes>

        </BrowserRouter>
    );
}

export default App;
