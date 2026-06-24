// Spinner de chargement — hérite de la couleur du texte (currentColor) et tourne
// via `animate-spin`. `aria-hidden` : purement décoratif, l'état de chargement est
// porté par `aria-busy`/`disabled` sur l'élément parent.
export function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      aria-hidden="true"
      className="animate-spin"
    >
      <circle
        cx="9"
        cy="9"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="32"
        strokeDashoffset="12"
      />
    </svg>
  )
}
