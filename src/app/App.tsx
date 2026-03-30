import { useEffect, useState } from "react";
import { Scale, UserCircle, LogIn, Menu, X } from "lucide-react";
import LandingPage from "./components/LandingPage";
import Sidebar from "./components/Sidebar";
import LoginModal from "./components/LoginModal";
import SignupModal from "./components/SignupModal";
import LawyersList from "./components/LawyersList";
import JudgesList from "./components/JudgesList";
import CourtsList from "./components/CourtsList";
import LawyerDetails from "./components/LawyerDetails";
import JudgeDetails from "./components/JudgeDetails";
import CourtDetails from "./components/CourtDetails";
import SearchLawyers from "./components/SearchLawyers";
import FindLawyerWizard from "./components/FindLawyerWizard";
import LawyerDashboard from "./components/LawyerDashboard";
import ClientDashboard from "./components/ClientDashboard";
import AdminDashboard from "./components/AdminDashboard";
import { getCurrentSession, checkCurrentUserAdmin } from "../utils/auth";

export type UserRole = "client" | "lawyer" | null;

type ParsedRoute = {
  view: string;
  selectedId: string | null;
  detailBackView?: string;
};

const toPath = (
  view: string,
  selectedId?: string | null,
  detailBackView?: string,
) => {
  if (view === "landing") return "/";
  if (view === "lawyers") return "/lawyers";
  if (view === "judges") return "/judges";
  if (view === "courts") return "/courts";
  if (view === "search") return "/search";
  if (view === "lawyer-dashboard") return "/dashboard/lawyer";
  if (view === "client-dashboard") return "/dashboard/client";
  if (view === "admin-dashboard") return "/dashboard/admin";

  if (view === "lawyer-details" && selectedId) {
    const fromSearch = detailBackView === "search" ? "?from=search" : "";
    return `/lawyers/${encodeURIComponent(selectedId)}${fromSearch}`;
  }
  if (view === "judge-details" && selectedId) {
    return `/judges/${encodeURIComponent(selectedId)}`;
  }
  if (view === "court-details" && selectedId) {
    return `/courts/${encodeURIComponent(selectedId)}`;
  }

  return "/";
};

const parsePathRoute = (pathname: string, search: string): ParsedRoute => {
  const normalizedPath = pathname.trim() || "/";
  const path = normalizedPath.startsWith("/") ? normalizedPath : `/${normalizedPath}`;
  const segments = path.split("/").filter(Boolean);
  const query = new URLSearchParams(search ?? "");

  if (segments.length === 0) {
    return { view: "landing", selectedId: null };
  }

  if (segments[0] === "lawyers") {
    if (segments[1]) {
      return {
        view: "lawyer-details",
        selectedId: decodeURIComponent(segments[1]),
        detailBackView: query.get("from") === "search" ? "search" : "lawyers",
      };
    }
    return { view: "lawyers", selectedId: null };
  }

  if (segments[0] === "judges") {
    if (segments[1]) {
      return {
        view: "judge-details",
        selectedId: decodeURIComponent(segments[1]),
      };
    }
    return { view: "judges", selectedId: null };
  }

  if (segments[0] === "courts") {
    if (segments[1]) {
      return {
        view: "court-details",
        selectedId: decodeURIComponent(segments[1]),
      };
    }
    return { view: "courts", selectedId: null };
  }

  if (segments[0] === "search") {
    return { view: "search", selectedId: null };
  }

  if (segments[0] === "dashboard") {
    if (segments[1] === "lawyer") return { view: "lawyer-dashboard", selectedId: null };
    if (segments[1] === "client") return { view: "client-dashboard", selectedId: null };
    if (segments[1] === "admin") return { view: "admin-dashboard", selectedId: null };
  }

  return { view: "landing", selectedId: null };
};

export default function App() {
  const [currentView, setCurrentView] =
    useState<string>("landing");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [loginRole, setLoginRole] = useState<
    "client" | "lawyer"
  >("client");
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(
    null,
  );
  const [detailBackView, setDetailBackView] = useState<string>("lawyers");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const applyRouteFromUrl = () => {
      const parsed = parsePathRoute(window.location.pathname, window.location.search);
      setCurrentView(parsed.view);
      setSelectedId(parsed.selectedId);
      if (parsed.detailBackView) {
        setDetailBackView(parsed.detailBackView);
      }
    };

    applyRouteFromUrl();
    window.addEventListener("popstate", applyRouteFromUrl);

    return () => {
      window.removeEventListener("popstate", applyRouteFromUrl);
    };
  }, []);

  const pushUrl = (
    view: string,
    id?: string | null,
    backView?: string,
    replace = false,
  ) => {
    const nextPath = toPath(view, id, backView);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current === nextPath) return;

    if (replace) {
      window.history.replaceState(null, "", nextPath);
    } else {
      window.history.pushState(null, "", nextPath);
    }
  };

  const handleLogin = async (
    email: string,
    password: string,
    role: "client" | "lawyer",
  ) => {
    try {
      // Get current session (already set by signIn in LoginModal)
      const session = await getCurrentSession();
      
      if (!session || !session.user) {
        console.error('No session found after login');
        return;
      }

      setUserId(session.user.id);
      setUserRole(role);

      // Check if user is admin (for lawyers only)
      if (role === "lawyer") {
        try {
          const isAdminUser = await checkCurrentUserAdmin();
          setIsAdmin(isAdminUser);

          // Redirect based on admin status
          if (isAdminUser) {
            navigateTo("admin-dashboard");
          } else {
            navigateTo("lawyer-dashboard");
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          // Default to lawyer dashboard if check fails
          navigateTo("lawyer-dashboard");
        }
      } else if (role === "client") {
        navigateTo("client-dashboard");
      }

      setShowLoginModal(false);
    } catch (error) {
      console.error('Error in handleLogin:', error);
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setIsAdmin(false);
    setCurrentView("landing");
    setSelectedId(null);
    pushUrl("landing");
    setMobileMenuOpen(false);
  };

  const navigateTo = (view: string) => {
    setCurrentView(view);
    if (!view.includes("-details")) {
      setSelectedId(null);
    }
    pushUrl(view);
    setMobileMenuOpen(false);
  };

  const openLoginModal = (role: "client" | "lawyer") => {
    setLoginRole(role);
    setShowLoginModal(true);
  };

  const openSignupModal = (role: "client" | "lawyer") => {
    setLoginRole(role);
    setShowSignupModal(true);
  };

  const viewLawyerDetails = (id: string) => {
    setSelectedId(id);
    setDetailBackView("lawyers");
    setCurrentView("lawyer-details");
    pushUrl("lawyer-details", id, "lawyers");
  };

  const viewLawyerDetailsFromSearch = (id: string) => {
    setSelectedId(id);
    setDetailBackView("search");
    setCurrentView("lawyer-details");
    pushUrl("lawyer-details", id, "search");
  };

  const viewJudgeDetails = (id: string) => {
    setSelectedId(id);
    setCurrentView("judge-details");
    pushUrl("judge-details", id);
  };

  const viewCourtDetails = (id: string) => {
    setSelectedId(id);
    setCurrentView("court-details");
    pushUrl("court-details", id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      {currentView !== "landing" && (
        <nav className="bg-white border-b border-[#e0e3e7] shadow-sm sticky top-0 z-50 backdrop-blur-sm bg-white/95">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                onClick={() => navigateTo("landing")}
                className="flex items-center gap-2 group"
              >
                <div className="bg-gradient-to-br from-[#1a2332] to-[#2d3d54] p-2 rounded-xl">
                  <Scale className="w-5 h-5 sm:w-6 sm:h-6 text-[#d4a574]" />
                </div>
                <span className="font-bold text-base sm:text-xl text-[#1a2332] group-hover:text-[#1e40af] transition-colors">
                  Judge My Lawyer
                </span>
              </button>

              <div className="hidden md:flex items-center gap-6">
                {!userRole ? (
                  <>
                    <button
                      onClick={() => navigateTo("lawyers")}
                      className="text-[#5f6368] hover:text-[#1e40af] font-semibold transition-colors"
                    >
                      Lawyers
                    </button>
                    <button
                      onClick={() => navigateTo("judges")}
                      className="text-[#5f6368] hover:text-[#7c3aed] font-semibold transition-colors"
                    >
                      Judges
                    </button>
                    <button
                      onClick={() => navigateTo("courts")}
                      className="text-[#5f6368] hover:text-[#047857] font-semibold transition-colors"
                    >
                      Courts
                    </button>
                    <button
                      onClick={() => navigateTo("search")}
                      className="text-[#5f6368] hover:text-[#1a2332] font-semibold transition-colors"
                    >
                      Find a Lawyer
                    </button>
                    <button
                      onClick={() => openLoginModal("client")}
                      className="flex items-center gap-2 bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white px-5 py-2.5 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                    >
                      <LogIn className="w-4 h-4" />
                      Login
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => navigateTo("lawyers")}
                      className="text-[#5f6368] hover:text-[#1e40af] font-semibold transition-colors"
                    >
                      Lawyers
                    </button>
                    <button
                      onClick={() => navigateTo("judges")}
                      className="text-[#5f6368] hover:text-[#7c3aed] font-semibold transition-colors"
                    >
                      Judges
                    </button>
                    <button
                      onClick={() => navigateTo("courts")}
                      className="text-[#5f6368] hover:text-[#047857] font-semibold transition-colors"
                    >
                      Courts
                    </button>
                    <button
                      onClick={() => navigateTo("search")}
                      className="text-[#5f6368] hover:text-[#1a2332] font-semibold transition-colors"
                    >
                      Find a Lawyer
                    </button>
                    {userRole === "lawyer" && !isAdmin && (
                      <button
                        onClick={() => navigateTo("lawyer-dashboard")}
                        className="text-[#5f6368] hover:text-[#1a2332] font-semibold transition-colors"
                      >
                        My Profile
                      </button>
                    )}
                    {userRole === "lawyer" && isAdmin && (
                      <button
                        onClick={() => navigateTo("admin-dashboard")}
                        className="text-[#5f6368] hover:text-[#1a2332] font-semibold transition-colors"
                      >
                        Admin Panel
                      </button>
                    )}
                    {userRole === "client" && (
                      <button
                        onClick={() => navigateTo("client-dashboard")}
                        className="text-[#5f6368] hover:text-[#1a2332] font-semibold transition-colors"
                      >
                        My Dashboard
                      </button>
                    )}
                    <div className="flex items-center gap-3 pl-6 border-l border-[#e0e3e7]">
                      <div className="bg-gradient-to-br from-[#1e40af] to-[#3b82f6] p-2 rounded-full">
                        <UserCircle className="w-5 h-5 text-white" />
                      </div>
                      <button
                        onClick={handleLogout}
                        className="text-sm font-semibold text-[#5f6368] hover:text-[#b91c1c] transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="md:hidden inline-flex items-center justify-center rounded-lg border border-[#e0e3e7] p-2 text-[#1a2332]"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>

            {mobileMenuOpen && (
              <div className="md:hidden border-t border-[#e0e3e7] py-3">
                <div className="flex flex-col gap-2">
                  <button onClick={() => navigateTo("lawyers")} className="text-left rounded-lg px-3 py-2 text-[#1a2332] hover:bg-[#f5f7fa]">Lawyers</button>
                  <button onClick={() => navigateTo("judges")} className="text-left rounded-lg px-3 py-2 text-[#1a2332] hover:bg-[#f5f7fa]">Judges</button>
                  <button onClick={() => navigateTo("courts")} className="text-left rounded-lg px-3 py-2 text-[#1a2332] hover:bg-[#f5f7fa]">Courts</button>
                  <button onClick={() => navigateTo("search")} className="text-left rounded-lg px-3 py-2 text-[#1a2332] hover:bg-[#f5f7fa]">Find a Lawyer</button>

                  {!userRole && (
                    <button
                      onClick={() => {
                        openLoginModal("client");
                        setMobileMenuOpen(false);
                      }}
                      className="mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#1e40af] to-[#3b82f6] text-white px-5 py-2.5 rounded-xl font-semibold"
                    >
                      <LogIn className="w-4 h-4" />
                      Login
                    </button>
                  )}

                  {userRole === "lawyer" && !isAdmin && (
                    <button onClick={() => navigateTo("lawyer-dashboard")} className="text-left rounded-lg px-3 py-2 text-[#1a2332] hover:bg-[#f5f7fa]">My Profile</button>
                  )}
                  {userRole === "lawyer" && isAdmin && (
                    <button onClick={() => navigateTo("admin-dashboard")} className="text-left rounded-lg px-3 py-2 text-[#1a2332] hover:bg-[#f5f7fa]">Admin Panel</button>
                  )}
                  {userRole === "client" && (
                    <button onClick={() => navigateTo("client-dashboard")} className="text-left rounded-lg px-3 py-2 text-[#1a2332] hover:bg-[#f5f7fa]">My Dashboard</button>
                  )}

                  {userRole && (
                    <button
                      onClick={handleLogout}
                      className="mt-2 rounded-lg px-3 py-2 text-left font-semibold text-[#b91c1c] hover:bg-red-50"
                    >
                      Logout
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-6">
          {/* Sidebar - visible on large screens */}
          <div className="hidden lg:block lg:col-span-3">
            <Sidebar onNavigate={navigateTo} />
          </div>

          {/* Primary content */}
          <div className="lg:col-span-9">
            {currentView === "landing" && (
              <LandingPage
                onNavigate={navigateTo}
                onLogin={openLoginModal}
                onViewLawyerDetails={viewLawyerDetails}
                onViewJudgeDetails={viewJudgeDetails}
                onViewCourtDetails={viewCourtDetails}
              />
            )}
        {currentView === "lawyers" && (
          <LawyersList onViewDetails={viewLawyerDetails} />
        )}
        {currentView === "judges" && (
          <JudgesList onViewDetails={viewJudgeDetails} />
        )}
        {currentView === "courts" && (
          <CourtsList onViewDetails={viewCourtDetails} />
        )}
        {currentView === "lawyer-details" && selectedId && (
          <LawyerDetails
            lawyerId={selectedId}
            onBack={() => navigateTo(detailBackView)}
          />
        )}
        {currentView === "judge-details" && selectedId && (
          <JudgeDetails
            judgeId={selectedId}
            onBack={() => navigateTo("judges")}
          />
        )}
        {currentView === "court-details" && selectedId && (
          <CourtDetails
            courtId={selectedId}
            onBack={() => navigateTo("courts")}
          />
        )}
        {currentView === "search" && (
          <FindLawyerWizard onViewDetails={viewLawyerDetailsFromSearch} />
        )}
        {currentView === "lawyer-dashboard" &&
          userRole === "lawyer" && <LawyerDashboard />}
        {currentView === "client-dashboard" &&
          userRole === "client" && (
            <ClientDashboard
              onViewDetails={viewLawyerDetails}
            />
          )}
        {currentView === "admin-dashboard" &&
          userRole === "lawyer" &&
          isAdmin && (
            <AdminDashboard
              onSwitchToLawyer={() => navigateTo("lawyer-dashboard")}
            />
          )}
          </div>
        </div>
      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          role={loginRole}
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLogin}
          onSwitchToSignup={() => {
            setShowLoginModal(false);
            setShowSignupModal(true);
          }}
        />
      )}

      {/* Signup Modal */}
      {showSignupModal && (
        <SignupModal
          role={loginRole}
          onClose={() => setShowSignupModal(false)}
          onSignup={handleLogin}
        />
      )}
    </div>
  );
}