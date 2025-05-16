import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        href:`${window.location.protocol}//${window.location.hostname}:2727/login?src=${window.location.href}`
      })
    }
  },
  component: AuthLayout,
})
function AuthLayout() {

  return (
    <div className="p-2 h-full">
      <Outlet />
    </div>
  )
}
