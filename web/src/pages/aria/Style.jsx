function Style() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      *{box-sizing:border-box;margin:0;padding:0}
      @keyframes chatblink{0%,80%,100%{opacity:.3}40%{opacity:1}}
      ::-webkit-scrollbar{width:4px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:rgba(192,214,234,0.15);border-radius:2px}
      textarea{overflow-y:hidden}
      .aria-md{font-size:13.5px;line-height:1.6}
      .aria-md h1,.aria-md h2,.aria-md h3{color:#DDFF55;margin:10px 0 6px;font-weight:700}
      .aria-md h1{font-size:16px}
      .aria-md h2{font-size:15px}
      .aria-md h3{font-size:14px}
      .aria-md h1:first-child,.aria-md h2:first-child,.aria-md h3:first-child{margin-top:0}
      .aria-md p{margin:0 0 8px}
      .aria-md p:last-child{margin-bottom:0}
      .aria-md strong{color:#F6F2E8;font-weight:700}
      .aria-md em{font-style:italic}
      .aria-md ul,.aria-md ol{margin:6px 0;padding-left:20px}
      .aria-md li{margin:3px 0;line-height:1.5}
      .aria-md ul li::marker,.aria-md ol li::marker{color:#DDFF55;font-weight:600}
      .aria-md code{background:rgba(192,214,234,0.1);padding:1px 5px;border-radius:4px;font-size:12px;font-family:'SF Mono','Fira Code',monospace}
      .aria-md pre{background:rgba(0,26,43,0.6);border:1px solid rgba(192,214,234,0.1);border-radius:8px;padding:10px 12px;overflow-x:auto;margin:8px 0}
      .aria-md pre code{background:none;padding:0}
      .aria-md blockquote{border-left:3px solid #DDFF55;margin:8px 0;padding:4px 12px;color:#C0D6EA}
      .aria-md a{color:#DDFF55;text-decoration:underline;text-underline-offset:2px}
      .aria-md hr{border:none;border-top:1px solid rgba(192,214,234,0.1);margin:10px 0}
      .aria-md table{border-collapse:collapse;margin:8px 0;font-size:12px;width:100%}
      .aria-md th,.aria-md td{border:1px solid rgba(192,214,234,0.1);padding:5px 8px;text-align:left}
      .aria-md th{background:rgba(192,214,234,0.08);font-weight:600}
      @media(max-width:700px){
        .aria-sidebar{display:flex!important;position:fixed!important;top:54px!important;left:0!important;bottom:0!important;width:85%!important;max-width:320px!important;z-index:50!important}
        .aria-sidebar-backdrop{display:block!important}
        .aria-chat-area{min-height:0!important}
        .aria-messages{padding:16px 12px!important;gap:8px!important}
        .aria-bubble{max-width:94%!important;font-size:14px!important;line-height:1.7!important;padding:10px 13px!important}
        .aria-md{font-size:14px!important;line-height:1.75!important}
        .aria-input-bar{padding:10px 12px!important}
        .aria-input-row{align-items:center!important;padding:6px 8px!important}
        .aria-input-field{font-size:13.5px!important;padding-top:2px!important}
      }
    `}</style>
  )
}