import {
  Navbar,
  NavbarContent,
  NavbarItem,
  NavbarMenu,
  NavbarMenuItem,
  NavbarMenuToggle,
  Link,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Image,
  Switch,
  NavbarBrand,
  User,
} from "@heroui/react";
import { useRouter } from "@tanstack/react-router";
import { type MouseEvent, useMemo, useState } from "react";
import blackEveImage from "../assets/eve-sso-login-black-small.png";
import whiteEveImage from "../assets/eve-sso-login-white-small.png";
import { MoonIcon, SunIcon } from "./Icons";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

const AuthMap = { 0: "GUEST", 1: "MEMBER", 2: "WORKER", 3: "ADMIN" } as const;
type AuthLevel = keyof typeof AuthMap;

type NavTo = "/" | "/dashboard" | "/list" | "/requests" | "/admin";

export function NavBar() {
  const authContext = useAuth();
  const isAuthenticated = authContext.isAuthenticated;
  const user = authContext.user;

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const router = useRouter();

  const makeNavHandler = (to: NavTo) => (event: MouseEvent) => {
    if (event.defaultPrevented) return;

    // Let the browser handle new-tab/window + non-left clicks.
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;

    event.preventDefault();
    setIsMenuOpen(false);
    router.navigate({ to });
  };

  const { theme, toggleTheme } = useTheme();

  const navItems = useMemo((): Array<{ label: string; to: NavTo }> => {
    if (!isAuthenticated) return [];

    const base: Array<{ label: string; to: NavTo }> = [
      { label: "Dashboard", to: "/dashboard" },
      { label: "List", to: "/list" },
      { label: "Requests", to: "/requests" },
    ];

    return user?.auth_level === 3
      ? [...base, { label: "Admin", to: "/admin" }]
      : base;
  }, [isAuthenticated, user?.auth_level]);

  return (
    <Navbar
      as="nav"
      className="bg-gray-800"
      maxWidth="full"
      isMenuOpen={isMenuOpen}
      onMenuOpenChange={setIsMenuOpen}
      shouldBlockScroll
    >
      <NavbarContent className="gap-3" justify="start">
        {isAuthenticated ? (
          <NavbarMenuToggle
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            className="sm:hidden"
          />
        ) : null}

        <NavbarBrand>
          <Link
            href="/"
            className="text-xl font-bold text-white sm:text-2xl"
            onClick={makeNavHandler("/")}
          >
            Brave BPC
          </Link>
        </NavbarBrand>

        {isAuthenticated ? (
          <div className="hidden items-center gap-4 sm:flex">
            {navItems.map((item) => (
              <NavbarItem key={item.to}>
                <Link href={item.to} onClick={makeNavHandler(item.to)}>
                  {item.label}
                </Link>
              </NavbarItem>
            ))}
          </div>
        ) : null}
      </NavbarContent>

      <NavbarContent as="div" justify="end">
        <Switch
          isSelected={theme === "dark"}
          color="success"
          endContent={<MoonIcon />}
          size="md"
          startContent={<SunIcon />}
          onChange={() => toggleTheme()}
        ></Switch>
        {isAuthenticated ? (
          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <User
                avatarProps={{
                  src:
                    "https://images.evetech.net/characters/" +
                    user?.character_id +
                    "/portrait?size=128",
                  isBordered: true,
                  radius: "sm",
                  color: "default",
                }}
                name={user?.character_name}
                description={
                  user?.auth_level != null
                    ? AuthMap[user.auth_level as AuthLevel]
                    : undefined
                }
                className="text-white"
              />
            </DropdownTrigger>
            <DropdownMenu aria-label="Profile Actions" variant="flat">
              <DropdownItem
                key="logout"
                color="danger"
                onClick={() => {
                  authContext.logout();
                  router.navigate({ to: "/" });
                }}
              >
                Log Out
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        ) : (
          <a
            href={`${window.location.protocol}//${window.location.hostname}:2727/login?src=${window.location.href}`}
          >
            <Image
              radius="none"
              width="135"
              src={
                window.location.origin +
                (theme === "dark" ? whiteEveImage : blackEveImage)
              }
              loading="eager"
            />
          </a>
        )}
      </NavbarContent>

      {isAuthenticated ? (
        <NavbarMenu>
          {navItems.map((item) => (
            <NavbarMenuItem key={item.to}>
              <Link
                className="w-full"
                href={item.to}
                onClick={makeNavHandler(item.to)}
              >
                {item.label}
              </Link>
            </NavbarMenuItem>
          ))}
        </NavbarMenu>
      ) : null}
    </Navbar>
  );
}
