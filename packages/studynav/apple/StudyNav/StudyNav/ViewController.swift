//
//  ViewController.swift
//  StudyNav
//
//  Created by Ник on 19.08.2026.
//

import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()

        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = true
        self.webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        self.webView.isOpaque = false

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let language = Locale.preferredLanguages.first?.lowercased().hasPrefix("ru") == true ? "ru" : "en"
        webView.evaluateJavaScript(
            "document.documentElement.dataset.language = '\(language)'; document.documentElement.lang = '\(language)';"
        )
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // Override point for customization.
    }

}
