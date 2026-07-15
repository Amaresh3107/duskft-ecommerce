import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
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

function App() {
  return (
    <div className="App">
      <AuthProvider>
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
              </Route>
              <Route path="/invoice/:orderId" element={<InvoicePrint />} />
              <Route path="/chat-demo" element={<ChatDemo />} />
              <Route path="/admin/knowledge-base" element={<KnowledgeBaseAdmin />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </CartProvider>
      </AuthProvider>
    </div>
  );
}

export default App;
