import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./App.css";

import Home from "./pages/Home";
import Professions from "./pages/Professions";
import Templates from "./pages/Templates";
import TemplatePreview from "./pages/TemplatePreview";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

import Builder from "./pages/Builder";
import Dashboard from "./pages/Dashboard";
import PortfolioPreview from "./pages/PortfolioPreview";
import ProtectedRoute from "./components/ProtectedRoute";
import PublicPortfolio from "./pages/PublicPortfolio";
import Profile from "./pages/Profile";
import AdminTemplates from "./pages/AdminTemplates";
import AdminTemplateEdit from "./pages/AdminTemplateEdit";
import AdminRoute from "./components/AdminRoute";
import AdminVerification from "./pages/AdminVerification";
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
import ThemeToggle from "./components/ThemeToggle";
import AdminLayout from "./components/AdminLayout";


function App() {

    return (
        <BrowserRouter>

            <ThemeToggle />

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
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />


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
                    element={<AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>}
                />
                <Route path="/admin/verify" element={<AdminVerification />} />
                <Route
                    path="/admin/users"
                    element={<AdminRoute><AdminLayout><AdminUsers /></AdminLayout></AdminRoute>}
                />
                <Route
                    path="/admin/users/:id"
                    element={<AdminRoute><AdminLayout><AdminUserDetails /></AdminLayout></AdminRoute>}
                />
                <Route
                    path="/admin/payments"
                    element={<AdminRoute><AdminLayout><AdminPayments /></AdminLayout></AdminRoute>}
                />
                <Route
                    path="/admin/payments/:id"
                    element={<AdminRoute><AdminLayout><AdminPaymentDetails /></AdminLayout></AdminRoute>}
                />
                <Route
                    path="/admin/credit-transactions"
                    element={<AdminRoute><AdminLayout><AdminCreditTransactions /></AdminLayout></AdminRoute>}
                />
                <Route
                    path="/admin/credit-transactions/:id"
                    element={<AdminRoute><AdminLayout><AdminCreditTransactionDetails /></AdminLayout></AdminRoute>}
                />
                <Route
                    path="/admin/portfolios"
                    element={<AdminRoute><AdminLayout><AdminPortfolios /></AdminLayout></AdminRoute>}
                />
                <Route
                    path="/admin/portfolios/:id"
                    element={<AdminRoute><AdminLayout><AdminPortfolioDetails /></AdminLayout></AdminRoute>}
                />
                <Route
                    path="/admin/templates"
                    element={<AdminRoute><AdminLayout><AdminTemplates /></AdminLayout></AdminRoute>}
                />
                <Route
                    path="/admin/templates/:id/edit"
                    element={<AdminRoute><AdminLayout><AdminTemplateEdit /></AdminLayout></AdminRoute>}
                />

            </Routes>

        </BrowserRouter>
    );
}

export default App;
