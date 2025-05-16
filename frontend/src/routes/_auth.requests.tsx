import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/requests')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_auth/requests"!</div>
}
