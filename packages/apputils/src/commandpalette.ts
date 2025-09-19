/* -----------------------------------------------------------------------------
| Copyright (c) Jupyter Development Team.
| Distributed under the terms of the Modified BSD License.
|----------------------------------------------------------------------------*/

import { searchIcon } from '@jupyterlab/ui-components';
import { Message } from '@lumino/messaging';
import { CommandPalette, Panel, Widget } from '@lumino/widgets';

/**
 * Class name identifying the input group with search icon.
 */
const SEARCH_ICON_GROUP_CLASS = 'jp-SearchIconGroup';

/**
 * Wrap the command palette in a modal to make it more usable.
 */
export class ModalCommandPalette extends Panel {
  constructor(options: ModalCommandPalette.IOptions) {
    super();
    this.addClass('jp-ModalCommandPalette');
    this.addClass('jp-ThemedContainer');
    this.id = 'modal-command-palette';
    this.palette = options.commandPalette;
    this._commandPalette.commands.commandExecuted.connect(() => {
      if (this.isAttached && this.isVisible) {
        this.hideAndReset();
      }
    });
    // required to properly receive blur and focus events;
    // selection of items with mouse may not work without this.
    this.node.tabIndex = 0;
  }

  get palette(): CommandPalette {
    return this._commandPalette;
  }

  set palette(value: CommandPalette) {
    this._commandPalette = value;
    if (!this.searchIconGroup) {
      this._commandPalette.inputNode.insertAdjacentElement(
        'afterend',
        this.createSearchIconGroup()
      );
    }
    this.addWidget(value);
    this.hideAndReset();
  }

  attach(): void {
    Widget.attach(this, document.body);
  }

  detach(): void {
    Widget.detach(this);
  }

  /**
   * Hide the modal command palette and reset its search.
   */
  hideAndReset(): void {
    this.hide();
    this._commandPalette.inputNode.value = '';
    this._commandPalette.refresh();
  }

  /**
   * Handle incoming events.
   */
  handleEvent(event: Event): void {
    switch (event.type) {
      case 'keydown':
        this._evtKeydown(event as KeyboardEvent);
        break;
      case 'blur': {
        // if the focus shifted outside of this DOM element, hide and reset.
        if (
          // focus went away from child element
          this.node.contains(event.target as HTMLElement) &&
          // and it did NOT go to another child element but someplace else
          !this.node.contains(
            (event as MouseEvent).relatedTarget as HTMLElement
          )
        ) {
          event.stopPropagation();
          this.hideAndReset();
        }
        break;
      }
      case 'contextmenu':
        event.preventDefault();
        event.stopPropagation();
        break;
      default:
        break;
    }
  }

  /**
   * Find the element with search icon group.
   */
  protected get searchIconGroup(): HTMLDivElement | undefined {
    return this._commandPalette.node.getElementsByClassName(
      SEARCH_ICON_GROUP_CLASS
    )[0] as HTMLDivElement;
  }

  /**
   * Create element with search icon group.
   */
  protected createSearchIconGroup(): HTMLDivElement {
    const inputGroup = document.createElement('div');
    inputGroup.classList.add(SEARCH_ICON_GROUP_CLASS);
    searchIcon.render(inputGroup);
    return inputGroup;
  }

  /**
   *  A message handler invoked on an `'after-attach'` message.
   */
  protected onAfterAttach(msg: Message): void {
    this.node.addEventListener('keydown', this, true);
    this.node.addEventListener('contextmenu', this, true);
  }

  /**
   *  A message handler invoked on an `'after-detach'` message.
   */
  protected onAfterDetach(msg: Message): void {
    this.node.removeEventListener('keydown', this, true);
    this.node.removeEventListener('contextmenu', this, true);
  }

  protected onBeforeHide(msg: Message): void {
    document.removeEventListener('blur', this, true);
  }

  protected onAfterShow(msg: Message): void {
    document.addEventListener('blur', this, true);
  }

  /**
   * A message handler invoked on an `'activate-request'` message.
   */
  protected onActivateRequest(msg: Message): void {
    if (this.isAttached) {
      // Capture the currently active widget before showing the palette
      const app = (window as any).jupyterapp;
      this._previousActiveWidget = app?.shell?.activeWidget;
      this._previousNotebookMode = undefined;
      
      // If it's a notebook, capture its mode
      if (this._previousActiveWidget && this._previousActiveWidget.content && 
          this._previousActiveWidget.content.mode !== undefined) {
        this._previousNotebookMode = this._previousActiveWidget.content.mode;
      }
      
      this.show();
      this._commandPalette.activate();
    }
  }

  /**
   * Handle the `'keydown'` event for the widget.
   */
  protected _evtKeydown(event: KeyboardEvent): void {
    // Check for escape key
    switch (event.keyCode) {
      case 27: // Escape.
        event.stopPropagation();
        event.preventDefault();
        
        // Use the previously captured widget and mode
        const activeWidget = this._previousActiveWidget;
        const notebookMode = this._previousNotebookMode;
        
        this.hideAndReset();
        
        // Restore focus and state to the previously active widget after the next frame
        // to ensure the command palette is fully hidden and DOM is updated
        requestAnimationFrame(() => {
          if (activeWidget && !activeWidget.isDisposed) {
            // Explicitly blur the command palette input if it still has focus
            if (document.activeElement === this._commandPalette.inputNode) {
              this._commandPalette.inputNode.blur();
            }
            
            activeWidget.activate();
            
            // For notebooks, restore the mode and ensure proper cell focus
            if (activeWidget.content && activeWidget.content.mode !== undefined) {
              const notebook = activeWidget.content;
              
              // Ensure the notebook has an active cell
              if (notebook.activeCell) {
                // Restore the notebook mode with proper focus
                if (notebookMode) {
                  notebook.setMode(notebookMode, { focus: true });
                } else {
                  // If no saved mode, default to command mode with focus
                  notebook.setMode('command', { focus: true });
                }
                
                // If setMode didn't properly focus, try focusing manually
                if (document.activeElement === document.body) {
                  notebook.node.focus();
                  
                  // If that doesn't work, try focusing the active cell directly
                  if (document.activeElement === document.body && notebook.activeCell) {
                    notebook.activeCell.node.focus();
                  }
                }
              }
            }
          }
        });
        break;
      default:
        break;
    }
  }

  private _commandPalette: CommandPalette;
  private _previousActiveWidget: any = null;
  private _previousNotebookMode: string | undefined = undefined;
}

export namespace ModalCommandPalette {
  export interface IOptions {
    commandPalette: CommandPalette;
  }
}
