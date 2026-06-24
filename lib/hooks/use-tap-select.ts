'use client'

import { useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'

/**
 * Interaction secondaire des listes drag & drop : tap pour sélectionner un élément,
 * tap sur un autre pour le déplacer à cette position.
 *
 * @param items    Liste courante (string codes dans l'ordre affiché)
 * @param onReorder  Callback appelé avec la nouvelle liste après un déplacement
 */
export function useTapSelect(
  items: string[],
  onReorder: (newItems: string[]) => void,
) {
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  const onRowTap = (code: string) => {
    if (selectedCode === null) {
      setSelectedCode(code)
    } else if (selectedCode === code) {
      setSelectedCode(null)
    } else {
      const fromIndex = items.indexOf(selectedCode)
      const toIndex   = items.indexOf(code)
      // La sélection peut être périmée si l'élément a disparu de la liste
      // entre deux taps (ex. suppression via ×) : on annule sans réordonner.
      if (fromIndex === -1 || toIndex === -1) { setSelectedCode(null); return }
      onReorder(arrayMove(items, fromIndex, toIndex))
      setSelectedCode(null)
    }
  }

  const onDragStart = () => setSelectedCode(null)

  return { selectedCode, onRowTap, onDragStart }
}
