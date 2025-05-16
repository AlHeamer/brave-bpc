import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/requests/$requestId')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_auth/requests/$requestId"!</div>
}
