import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";
import RunLog from "@/pages/RunLog";
import AppShell from "@/components/AppShell";

export default function App() {
  return (
    <Router>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/run-log" element={<RunLog />} />
        </Routes>
      </AppShell>
    </Router>
  );
}
