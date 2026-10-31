RSI Enhanced is an independent companion for Star Citizen’s RSI website. It gives you more control over Spectrum’s appearance and adds practical tools to the RSI pages you already use.

In Spectrum, choose from 16 built-in themes, adjust colours, fonts, text size, forum width and spacing, and pick how replies are displayed. Save forum threads, filter notifications, and hide posts from selected authors on your own screen. Friends, Messages, Bookmarks and chat panels get a clearer, more consistent look.

The extension also improves the layout and readability of RSI account and profile pages, the Pledge Store, Ship Matrix, Organizations, Comm-Link, Patch Notes, Roadmap Release View, Funding Goals and Dev Tracker. 
In your Hangar, you can search across pages, filter and sort items, switch between list and grid views, change how many items appear per page, export your collection, and preview item images.
Funding Goals keeps RSI’s live totals and chart controls, with additional history charts based on a public Google Sheet.(Credit goes to CCUGame for the spreadsheet).

I cannot guarantee everything will work for everyone as everyone's browsers are different and everyone will have different extensions installed. 
If you have things like ad blockers or extensions that block malware or scams in browser for example, Malwarebytes, they may block things like the fund stats from updating correctly.


Disclaimer:
Your preferences and saved items are kept in your browser’s local extension storage. RSI Enhanced has no analytics or telemetry. The funding history feature reads a public Google Sheet; Google receives the usual request details, such as your IP address and request time. 
That request does not include RSI account or Hangar information.

This extension was made using AI. I do not claim to be a programmer or know how to code. I, as a backer, just wanted better functionality and experience while using CIG's website. This was meant to be a personal extension but it grew over time and I thought it would be more beneficial to release it to everyone.
If you do not like that AI was used, I encourage you to add other extensions like HangerXPLOR or CCU Game they are very good and informative extensions.

What is stored and sent:

Settings, saved threads, local post-block preferences, Hangar favourites, and the normalized Hangar index use browser-local extension storage. They are not sent to an extension developer server, analytics service, or advertising service. 
The extension contains no analytics or telemetry code. The extension does not add encryption to locally stored values, so protect access to your browser profile and device.

To rebuild the per-handle post-block list across open tabs, the extension reads its own local storage entries and filters for its saved-handle keys. This lookup stays inside the extension and is not transmitted anywhere.

Hangar tools read the current page and may request other Hangar pages only when the user searches, filters, exports, refreshes, or uses a cross-page view. If a cross-page display or Ship Paint mode was saved, it may request the needed pages when Hangar opens. 
These requests use the normal same-site RSI session and do not change pledges or account settings. The normalized index is valid for 15 minutes and is not reused after expiry. 
An expired copy is removed the next time an indexing action checks it, so it may remain in local storage until then. CSV export prefixes formula-like text with an apostrophe so spreadsheet applications treat it as text. 
CSV and Hangar Transfer exports can contain account-linked pledge IDs, names, item details, and values; review them before sharing.

Organization profile Connect panels mirror only credential-free HTTP(S) links from the page. Copied links opened in a new tab use opener isolation.

When the user opens Extend conversation, the extension makes read-only, same-origin Spectrum requests for the original post and its parent replies. Context images are accepted only from HTTPS robertsspaceindustries.com domains and subdomains. Image requests omit referrer information.

Funding Goals reads a public Google Sheets document without sending account or Hangar data or Google credentials. Google still receives ordinary request metadata, including the user's IP address and request time. The extension also caches funding history locally.

The extension does not read or store passwords or browser cookies. Same-origin RSI page requests use the browser's existing signed-in session where the site requires it.
