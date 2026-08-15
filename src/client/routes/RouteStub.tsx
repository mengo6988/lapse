interface RouteStubProps {
  title: string
}

/** honest placeholder for screens not yet designed/built (docs/spec.md milestone 5). */
export function RouteStub({ title }: RouteStubProps) {
  return (
    <section className="route-stub" aria-label={title}>
      <p className="route-stub__title">{title}</p>
      <p className="route-stub__note">not built yet — arrives in milestone 5</p>
    </section>
  )
}
