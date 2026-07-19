import type { FileDropEvent } from 'file-drop-element';
import type SnackBarElement from 'shared/custom-els/snack-bar';
import type { SnackOptions } from 'shared/custom-els/snack-bar';

import { h, Component } from 'preact';

import { linkRef } from 'shared/prerendered-app/util';
import * as style from './style.css';
import 'add-css:./style.css';
import 'file-drop-element';
import 'shared/custom-els/snack-bar';
import Intro from 'shared/prerendered-app/Intro';
import 'shared/custom-els/loading-spinner';

const ROUTE_EDITOR = '/editor';

const compressPromise = import('client/lazy-app/Compress');
const swBridgePromise = import('client/lazy-app/sw-bridge');

function back() {
  window.history.back();
}

interface Props {}

interface State {
  awaitingShareTarget: boolean;
  /**
   * All files the user has loaded. The editor previews `files[selectedIndex]`;
   * a future batch mode processes the whole array. Single-file flows are just
   * `files.length === 1`.
   */
  files: File[];
  selectedIndex: number;
  isEditorOpen: Boolean;
  Compress?: typeof import('client/lazy-app/Compress').default;
}

export default class App extends Component<Props, State> {
  state: State = {
    awaitingShareTarget: new URL(location.href).searchParams.has(
      'share-target',
    ),
    isEditorOpen: false,
    files: [],
    selectedIndex: 0,
    Compress: undefined,
  };

  snackbar?: SnackBarElement;

  constructor() {
    super();

    compressPromise
      .then((module) => {
        this.setState({ Compress: module.default });
      })
      .catch(() => {
        this.showSnack('Failed to load app');
      });

    swBridgePromise.then(async ({ offliner, getSharedImage }) => {
      offliner(this.showSnack);
      if (!this.state.awaitingShareTarget) return;
      const file = await getSharedImage();
      // Remove the ?share-target from the URL
      history.replaceState('', '', '/');
      this.openEditor();
      this.setState({
        files: file ? [file] : [],
        selectedIndex: 0,
        awaitingShareTarget: false,
      });
    });

    // Since iOS 10, Apple tries to prevent disabling pinch-zoom. This is great in theory, but
    // really breaks things on Squoosh, as you can easily end up zooming the UI when you mean to
    // zoom the image. Once you've done this, it's really difficult to undo. Anyway, this seems to
    // prevent it.
    document.body.addEventListener('gesturestart', (event: any) => {
      event.preventDefault();
    });

    window.addEventListener('popstate', this.onPopState);
  }

  private onFileDrop = ({ files }: FileDropEvent) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const wasEditorOpen = this.state.isEditorOpen;
    this.openEditor();
    this.setState({ files: fileArray, selectedIndex: 0 });
    // Dropping onto an already-open editor swaps the image in place.
    if (wasEditorOpen) this.confirmSwap(fileArray[0]);
  };

  private onIntroPickFile = (file: File) => {
    this.openEditor();
    this.setState({ files: [file], selectedIndex: 0 });
  };

  /**
   * Swap the source image while staying in the editor, so the current
   * encoder/processing settings carry over to the new file.
   */
  private onEditorPickFile = (file: File) => {
    this.setState({ files: [file], selectedIndex: 0 });
    this.confirmSwap(file);
  };

  private confirmSwap(file: File) {
    this.showSnack(`Now editing “${file.name}”`, { timeout: 3000 });
  }

  private showSnack = (
    message: string,
    options: SnackOptions = {},
  ): Promise<string> => {
    if (!this.snackbar) throw Error('Snackbar missing');
    return this.snackbar.showSnackbar(message, options);
  };

  private onPopState = () => {
    this.setState({ isEditorOpen: location.pathname === ROUTE_EDITOR });
  };

  private openEditor = () => {
    if (this.state.isEditorOpen) return;
    // Change path, but preserve query string.
    const editorURL = new URL(location.href);
    editorURL.pathname = ROUTE_EDITOR;
    history.pushState(null, '', editorURL.href);
    this.setState({ isEditorOpen: true });
  };

  render(
    {}: Props,
    {
      files,
      selectedIndex,
      isEditorOpen,
      Compress,
      awaitingShareTarget,
    }: State,
  ) {
    const showSpinner = awaitingShareTarget || (isEditorOpen && !Compress);
    const selectedFile = files[selectedIndex];

    return (
      <div class={style.app}>
        <file-drop onfiledrop={this.onFileDrop} class={style.drop}>
          {showSpinner ? (
            <loading-spinner class={style.appLoader} />
          ) : isEditorOpen ? (
            Compress &&
            selectedFile && (
              <Compress
                file={selectedFile}
                showSnack={this.showSnack}
                onBack={back}
                onNewFile={this.onEditorPickFile}
              />
            )
          ) : (
            <Intro onFile={this.onIntroPickFile} showSnack={this.showSnack} />
          )}
          <snack-bar ref={linkRef(this, 'snackbar')} />
        </file-drop>
      </div>
    );
  }
}
