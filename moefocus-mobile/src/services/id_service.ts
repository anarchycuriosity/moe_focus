export function create_uuid(): string
{
  const random_part = Math.random().toString(16).slice(2)
  const time_part = Date.now().toString(16)
  return `${time_part}-${random_part.slice(0, 4)}-${random_part.slice(4, 8)}-${random_part.slice(8, 12)}-${random_part.slice(12, 24).padEnd(12, '0')}`
}
