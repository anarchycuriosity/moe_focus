import { exec } from 'child_process'
import { existsSync } from 'fs'
import { DatabaseService } from './DatabaseService'

export class TyporaService
{
  static open(file_path: string): void
  {
    const db = DatabaseService.instance
    const typora_setting = db.get('SELECT value FROM settings WHERE key = ?', ['typora.path'])
    let typora_path = (typora_setting as { value: string } | undefined)?.value || ''

    // Auto-detect from default Windows install path
    if (!typora_path)
    {
      const default_path = 'C:\\Program Files\\Typora\\Typora.exe'
      if (existsSync(default_path))
      {
        typora_path = default_path
      }
    }

    if (!typora_path || !existsSync(typora_path))
    {
      console.log('Typora not found at:', typora_path)
      return
    }

    exec(`"${typora_path}" "${file_path}"`, (error) =>
    {
      if (error)
      {
        console.error('Failed to open Typora:', error.message)
      }
      else
      {
        console.log('Typora opened:', file_path)
      }
    })
  }
}
