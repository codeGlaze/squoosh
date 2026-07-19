// A self-contained launcher for Squoosh.
//
// The entire built app is embedded into this binary (see //go:embed below), so
// the executable is the whole thing — no external files, no runtime. It serves
// the app on a fixed localhost port with the COOP/COEP headers the multithreaded
// codecs need (localhost is a "secure context", so plain HTTP is enough for the
// service worker and PWA install), then opens the browser.
//
// Localhost is a secure context, so from here you can click the browser's
// "Install" button to install Squoosh as a proper offline app; after that the
// service worker owns everything and you can close this launcher for good.
package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"time"
)

// all: so dotfiles / underscore files (e.g. _headers) are embedded too.
//
//go:embed all:app
var embedded embed.FS

// A fixed port keeps the PWA install stable across runs (the install is bound
// to the origin, which includes the port).
const preferredPort = 8787

func withHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// /editor is a client-side route; mirror the deployed app's redirect.
		if r.URL.Path == "/editor" {
			http.Redirect(w, r, "/", http.StatusFound)
			return
		}
		h := w.Header()
		// Cross-origin isolation → SharedArrayBuffer → threaded wasm codecs.
		h.Set("Cross-Origin-Embedder-Policy", "require-corp")
		h.Set("Cross-Origin-Opener-Policy", "same-origin")
		h.Set("Cache-Control", "no-cache")
		next.ServeHTTP(w, r)
	})
}

func openBrowser(url string) {
	var cmd string
	var args []string
	switch runtime.GOOS {
	case "windows":
		cmd, args = "cmd", []string{"/c", "start", "", url}
	case "darwin":
		cmd, args = "open", []string{url}
	default:
		cmd, args = "xdg-open", []string{url}
	}
	_ = exec.Command(cmd, args...).Start()
}

func main() {
	appFS, err := fs.Sub(embedded, "app")
	if err != nil {
		log.Fatal(err)
	}

	// Prefer the fixed port; fall back to a random free one if it's taken.
	port := preferredPort
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		ln, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			log.Fatal(err)
		}
		port = ln.Addr().(*net.TCPAddr).Port
		fmt.Printf("(port %d was busy, using %d instead)\n", preferredPort, port)
	}

	url := fmt.Sprintf("http://localhost:%d/", port)
	fmt.Println("=======================================================")
	fmt.Println("  Squoosh is running at:  " + url)
	fmt.Println()
	fmt.Println("  A browser tab should open automatically.")
	fmt.Println("  To install it as a real offline app, click the")
	fmt.Println("  install icon in the address bar (Chrome/Edge/Brave).")
	fmt.Println("  Once installed you can close this window for good.")
	fmt.Println()
	fmt.Println("  Press Ctrl+C to stop.")
	fmt.Println("=======================================================")

	go func() {
		time.Sleep(600 * time.Millisecond)
		openBrowser(url)
	}()

	if err := http.Serve(ln, withHeaders(http.FileServer(http.FS(appFS)))); err != nil {
		log.Fatal(err)
	}
}
