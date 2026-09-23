/**
 * Command browser client. The copy button writes the command to the
 * clipboard; when clipboard access is denied it degrades silently and
 * the static command still reads and selects. No Effect or Schema here.
 */

function flashCopied(button: HTMLElement): void {
  const original = button.textContent
  button.textContent = 'copied'

  window.setTimeout(() => {
    button.textContent = original
  }, 1200)
}

function copyFallback(command: string): boolean {
  const area = document.createElement('textarea')
  area.value = command
  area.setAttribute('readonly', '')
  document.body.appendChild(area)
  area.select()

  let done = false

  try {
    done = document.execCommand('copy')
  } catch {
    done = false
  }

  area.remove()

  return done
}

function copyCommand(root: HTMLElement, button: HTMLElement): void {
  const code = root.querySelector('.cmd')

  if (!(code instanceof HTMLElement)) {
    return
  }

  const command = code.textContent ?? ''

  if (command.length === 0) {
    return
  }

  const clipboard = navigator.clipboard

  if (clipboard !== undefined && clipboard !== null) {
    clipboard.writeText(command).then(
      () => {
        flashCopied(button)
      },
      () => {
        if (copyFallback(command)) {
          flashCopied(button)
        }
      }
    )

    return
  }

  if (copyFallback(command)) {
    flashCopied(button)
  }
}

function initCommand(root: HTMLElement): void {
  if (root.getAttribute('data-cmd-live') === 'true') {
    return
  }

  root.setAttribute('data-cmd-live', 'true')

  const button = root.querySelector('.copy')

  if (!(button instanceof HTMLElement)) {
    return
  }

  button.addEventListener('click', () => {
    copyCommand(root, button)
  })
}

function initAllCommands(): void {
  const roots = document.querySelectorAll('.aha-cmd[data-cmd-id]')

  for (let index = 0; index < roots.length; index += 1) {
    const root = roots.item(index)

    if (root instanceof HTMLElement) {
      initCommand(root)
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllCommands)
} else {
  initAllCommands()
}
