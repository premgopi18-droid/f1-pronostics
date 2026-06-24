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

  // Dérivé pendant le render : si l'élément sélectionné a disparu de la liste
  // (ex. suppression via × dans QualifsForm), on le considère désélectionné.
  const activeCode = selectedCode !== null && items.includes(selectedCode) ? selectedCode : null

  const onRowTap = (code: string) => {
    if (activeCode === null) {
      setSelectedCode(code)
    } else if (activeCode === code) {
      setSelectedCode(null)
    } else {
      onReorder(arrayMove(items, items.indexOf(activeCode), items.indexOf(code)))
      setSelectedCode(null)
    }
  }

  const onDragStart = () => setSelectedCode(null)

  return { selectedCode: activeCode, onRowTap, onDragStart }
}
