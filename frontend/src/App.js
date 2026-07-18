import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { AdminAuthProvider } from "@/context/AdminAuthContext";
import { CartProvider } from "@/context/CartContext";
import StorefrontLayout from "@/layouts/StorefrontLayout";
import StorefrontHome from "@/pages/StorefrontHome";
import Catalog from "@/pages/Catalog";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import InvoicePrint from "@/pages/InvoicePrint";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ChatDemo from "@/pages/ChatDemo";
import KnowledgeBaseAdmin from "@/pages/KnowledgeBaseAdmin";
import AdminLayout from "@/layouts/AdminLayout";
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminProducts from "@/pages/admin/Products";
import AdminCategories from "@/pages/admin/Categories";
import AdminOrders from "@/pages/admin/Orders";
import AdminQuotes from "@/pages/admin/Quotes";
import AdminInvoices from "@/pages/admin/Invoices";
import AdminPayments from "@/pages/admin/Payments";
import AdminReturns from "@/pages/admin/Returns";
import AdminPrintJobs from "@/pages/admin/PrintJobs";
import AdminShippingZones from "@/pages/admin/ShippingZones";
import AdminBankAccounts from "@/pages/admin/BankAccounts";
import AdminSettings from "@/pages/admin/Settings";
import PortalLayout from "@/layouts/PortalLayout";
import PortalDashboard from "@/pages/portal/Dashboard";
import PortalOrders from "@/pages/portal/Orders";
import PortalOrderDetail from "@/pages/portal/OrderDetail";
import PortalWishlist from "@/pages/portal/Wishlist";
import PortalAddresses from "@/pages/portal/Addresses";
import PortalProfile from "@/pages/portal/Profile";

function App() {
  return (
    <div className="App">
      <AuthProvider>
      <AdminAuthProvider>
        <CartProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<StorefrontLayout />}>
                <Route path="/" element={<StorefrontHome />} />
                <Route path="/catalog" element={<Catalog />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/portal" element={<PortalLayout />}>
                  <Route path="dashboard" element={<PortalDashboard />} />
                  <Route path="orders" element={<PortalOrders />} />
                  <Route path="orders/:orderId" element={<PortalOrderDetail />} />
                  <Route path="wishlist" element={<PortalWishlist />} />
                  <Route path="addresses" element={<PortalAddresses />} />
                  <Route path="profile" element={<PortalProfile />} />
                </Route>
              </Route>
              <Route path="/invoice/:orderId" element={<InvoicePrint />} />
              <Route path="/chat-demo" element={<ChatDemo />} />
              <Route path="/admin/knowledge-base" element={<KnowledgeBaseAdmin />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminLayout />}>
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="products" element={<AdminProducts />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="orders" element={<AdminOrders />} />
                <Route path="quotes" element={<AdminQuotes />} />
                <Route path="invoices" element={<AdminInvoices />} />
                <Route path="payments" element={<AdminPayments />} />
                <Route path="returns" element={<AdminReturns />} />
                <Route path="print-jobs" element={<AdminPrintJobs />} />
                <Route path="shipping-zones" element={<AdminShippingZones />} />
                <Route path="bank-accounts" element={<AdminBankAccounts />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
            </Routes>
          </BrowserRouter>
          <Toaster position="bottom-right" offset={{ bottom: '150px', right: '50px' }} />
        </CartProvider>
      </AdminAuthProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
