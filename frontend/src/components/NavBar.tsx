import { Navbar, NavbarContent, NavbarItem, Link, Dropdown, DropdownTrigger, Avatar, DropdownMenu, DropdownItem } from '@heroui/react';
import { AuthContext } from '../contexts/AuthContext';

export function NavBar({ authContext }: { authContext: AuthContext }) {
    const isAuthenticated = authContext?.isAuthenticated
    const user = authContext?.user

    return (<Navbar as="nav" className="bg-gray-800">
        <NavbarContent className="hidden sm:flex gap-4" justify="center">

            {isAuthenticated ? (<>

                <NavbarItem>
                    <Link color="foreground" href="/dashboard">
                        Dashboard
                    </Link>
                </NavbarItem>
                <NavbarItem>
                    <Link color="foreground" href="/list">
                        List
                    </Link>
                </NavbarItem>
                <NavbarItem>
                    <Link color="foreground" href="/requests">
                        Requests
                    </Link>
                </NavbarItem></>) : (<NavbarItem>
                    <Link color="foreground" href="/">
                        Home
                    </Link>
                </NavbarItem>)}
            {user?.level === 'admin' && (<NavbarItem>
                <Link color="foreground" href="/admin">
                    Admin
                </Link>
            </NavbarItem>)}

        </NavbarContent>
        <NavbarContent as="div" justify="end">
            {isAuthenticated ? (<Dropdown placement="bottom-end">
                <DropdownTrigger>
                    <Avatar
                        isBordered
                        as="button"
                        className="transition-transform"
                        color="secondary"
                        name={user?.name}
                        size="sm"
                        src={"https://images.evetech.net/characters/" + user?.charId + "/portrait"}
                    />
                </DropdownTrigger>
                <DropdownMenu aria-label="Profile Actions" variant="flat">
                    <DropdownItem key="profile" className="h-14 gap-2">
                        <p className="font-semibold">Signed in as</p>
                        <p className="font-semibold">{user?.name} | {user?.level}</p>
                    </DropdownItem>
                    <DropdownItem key="logout" color="danger">
                        Log Out
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>) : <Link color="foreground" href="/login">Login</Link>}

        </NavbarContent>
    </Navbar>)
}