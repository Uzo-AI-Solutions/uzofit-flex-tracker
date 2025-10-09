import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Workouts from "./pages/Workouts";
import WorkoutCreate from "./pages/WorkoutCreate";
import WorkoutDetail from "./pages/WorkoutDetail";
import Plans from "./pages/Plans";
import PlanCreate from "./pages/PlanCreate";
import PlanDetail from "./pages/PlanDetail";
import SessionActive from "./pages/SessionActive";
import SessionDetail from "./pages/SessionDetail";
import History from "./pages/History";
import ImportExport from "./pages/ImportExport";
import Trainer from "./pages/Trainer";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/workouts" element={<ProtectedRoute><Workouts /></ProtectedRoute>} />
          <Route path="/workouts/create" element={<ProtectedRoute><WorkoutCreate /></ProtectedRoute>} />
          <Route path="/workouts/:id" element={<ProtectedRoute><WorkoutDetail /></ProtectedRoute>} />
          <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
          <Route path="/plans/create" element={<ProtectedRoute><PlanCreate /></ProtectedRoute>} />
          <Route path="/plans/:id" element={<ProtectedRoute><PlanDetail /></ProtectedRoute>} />
          <Route path="/sessions/active/:id" element={<ProtectedRoute><SessionActive /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/history/:id" element={<ProtectedRoute><SessionDetail /></ProtectedRoute>} />
          <Route path="/import-export" element={<ProtectedRoute><ImportExport /></ProtectedRoute>} />
          <Route path="/trainer" element={<ProtectedRoute><Trainer /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
