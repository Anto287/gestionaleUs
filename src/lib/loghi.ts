import type { LogoSquadra } from '../types'
export function chiaveSquadra(nome: string): string {
  return nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
export function logoSquadra(loghi: LogoSquadra[], nome: string): LogoSquadra | undefined {
  const key = chiaveSquadra(nome)
  return key ? loghi.find((l) => [l.nome, ...l.alias].some((n) => chiaveSquadra(n) === key)) : undefined
}
