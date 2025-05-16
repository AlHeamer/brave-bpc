import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>
    <h1 className="text-3xl font-bold underline">
    Welcome to Brave's BPC Request Program!
    </h1>
    <p>Thank you for you interest in Brave's BPC Program. This program is intended to be used by members of Brave Collective to help them build whatever Brave needs.</p>
    
  </div>
}
