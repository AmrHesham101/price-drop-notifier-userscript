NOTES

- Userscript targets Amazon and eBay product pages using common selectors. Some pages (regional variations) may need selector tweaks.
- CSP: The userscript first attempts to load the widget script from the demo server; if the host page's CSP blocks external scripts, we fallback to iframe embedding which loads the widget from the demo origin.
- CSS collision example: Amazon's global `img, a` rules occasionally reset button appearance; widget uses scoped class names and a dedicated stylesheet loaded from `/assets` to reduce collisions.
