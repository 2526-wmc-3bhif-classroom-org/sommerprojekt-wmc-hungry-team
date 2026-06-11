export interface Routine {
  id: string
  name: string
  startTime: string
  endTime: string
  days: number[]
  transportMode: string
  destination: string
  startAddress: string
  config: {
    alarms?: Array<{ id: string; time: string; enabled: boolean }>
    [key: string]: unknown
  }
  createdAt: string
  updatedAt: string
}
