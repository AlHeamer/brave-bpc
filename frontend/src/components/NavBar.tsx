import {
  Navbar,
  NavbarContent,
  NavbarItem,
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
import { AuthContext } from "../contexts/AuthContext";
import { useRouter } from "@tanstack/react-router";
import blackEveImage from "../assets/eve-sso-login-black-small.png";
import whiteEveImage from "../assets/eve-sso-login-white-small.png";
import { MoonIcon, SunIcon } from "./Icons";
import { useTheme } from "../contexts/ThemeContext";

const AuthMap = { 0: "GUEST", 1: "MEMBER", 2: "WORKER", 3: "ADMIN" } as const;
type AuthLevel = keyof typeof AuthMap;

export function NavBar({ authContext }: { authContext: AuthContext }) {
  const isAuthenticated = authContext?.isAuthenticated;
  const user = authContext?.user;

  const router = useRouter();

  const { theme, toggleTheme } = useTheme();

  return (
    <Navbar as="nav" className="bg-gray-800" maxWidth="full">
      <NavbarContent className="hidden sm:flex gap-4" justify="start">
        <NavbarBrand>
          <Link href="/" className="text-2xl font-bold text-white">
            Brave BPC
          </Link>
        </NavbarBrand>
        {isAuthenticated && (
          <>
            <NavbarItem>
              <Link href="/dashboard">Dashboard</Link>
            </NavbarItem>
            <NavbarItem>
              <Link href="/list">List</Link>
            </NavbarItem>
            <NavbarItem>
              <Link href="/requests">Requests</Link>
            </NavbarItem>
          </>
        )}
        {user?.auth_level === 3 && (
          <NavbarItem>
            <Link href="/admin">Admin</Link>
          </NavbarItem>
        )}
      </NavbarContent>

      <NavbarContent as="div" justify="end">
        <Switch
          isSelected={theme === "dark"}
          color="success"
          endContent={<MoonIcon />}
          size="lg"
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
                    "/portrait",
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
    </Navbar>
  );
}
