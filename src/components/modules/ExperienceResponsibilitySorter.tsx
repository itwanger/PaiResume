import { TextItemSorter } from '../ui/TextItemSorter'

interface Props {
  responsibilities: string[]
  onReorder: (sourceIndex: number, targetIndex: number) => void
}

export function ExperienceResponsibilitySorter({ responsibilities, onReorder }: Props) {
  return (
    <TextItemSorter
      items={responsibilities}
      itemLabel="职责"
      ariaLabel="核心职责排序"
      onReorder={onReorder}
    />
  )
}
