import ARRoot from '@/components/ARRoot'
import AndroidCompatibility from '@/components/AndroidCompatibility'
import IOSCompatibility from '@/components/IOSCompatibility'

export default function page() {
  return (
    <IOSCompatibility>
      <AndroidCompatibility>
        <ARRoot />
      </AndroidCompatibility>
    </IOSCompatibility>
  )
}
