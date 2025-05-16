import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/list')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_auth/list"!</div>
}
