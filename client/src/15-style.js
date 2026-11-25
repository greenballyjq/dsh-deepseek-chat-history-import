    const CSS = `
.dsdi-root{display:flex;flex-direction:column;height:100%;min-height:0;gap:10px;padding:16px 18px;box-sizing:border-box;color:var(--dsw-alias-label-primary,#1f2329);font-size:13px;overflow:hidden}
.dsdi-title{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.dsdi-title h1{font-size:16px;font-weight:600;margin:0}
.dsdi-hint{color:var(--dsw-alias-label-secondary,#8a8f99);font-size:12px}
.dsdi-filename{color:#1f2329;font-size:12px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dsdi-input{flex:1 1 320px;min-width:220px;height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:13px;outline:none;box-sizing:border-box}
.dsdi-input:focus{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.dsdi-btn{height:32px;padding:0 14px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
.dsdi-btn:hover{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.dsdi-btn:disabled{opacity:.45;cursor:not-allowed}
.dsdi-btn.primary{background:var(--dsw-alias-brand-primary,#4d6bfe);border-color:var(--dsw-alias-brand-primary,#4d6bfe);color:#fff}
.dsdi-status{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:var(--dsw-alias-label-secondary,#8a8f99);font-size:12px;min-height:18px}
.dsdi-job{margin:4px 0 0;border-radius:10px;background:#eef2ff;border:1px solid #c9d4ff;padding:10px 12px}
.dsdi-job.done{background:#eaf7ee;border-color:#b9e3c9}
.dsdi-job.failed{background:#fdf1f0;border-color:#f0c2bf}
.dsdi-jobhead{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.dsdi-jobtitle{font-size:13px;font-weight:600;color:#1f2329}
.dsdi-jobpercent{font-size:12px;color:#4d6bfe}
.dsdi-jobsub{font-size:11px;color:#8a8f99;margin-top:2px}
.dsdi-jobbar{margin:8px 0;height:8px;border-radius:4px;background:#dbe3ff;overflow:hidden}
.dsdi-jobfill{height:100%;background:#4d6bfe;border-radius:4px;transition:width .3s}
.dsdi-jobmeta{font-size:11px;color:#8a8f99;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.dsdi-jobactions{display:flex;gap:8px;margin-top:8px}
.dsdi-jobsegments{margin-top:8px;max-height:150px;overflow:auto;background:#fff;border:1px solid #eef1f5;border-radius:8px;padding:8px 10px}
.dsdi-jobsegment{font-size:11px;color:#1f2329;line-height:1.6;margin-bottom:4px;white-space:pre-wrap;word-break:break-word}
.dsdi-jobsegment.pending{color:#8a8f99}
.dsdi-badge{padding:1px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2,#f2f4f7);border:1px solid var(--dsw-alias-border-l1,#d9dce1);font-size:11px}
.dsdi-badge.ok{color:var(--dsw-alias-state-success-primary,#1a7f37);border-color:var(--dsw-alias-state-success-primary,#1a7f37)}
.dsdi-list{flex:1 1 auto;min-height:0;overflow:auto;border:1px solid var(--dsw-alias-border-l1,#d9dce1);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#fff);position:relative}
.dsdi-rowitem{display:flex;align-items:center;gap:10px;height:${ROW_HEIGHT}px;padding:0 12px;box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l1,#eef0f3);cursor:pointer}
.dsdi-rowitem:hover{background:var(--dsw-alias-bg-layer-2,#f7f8fa)}
.dsdi-rowitem.selected{background:var(--dsw-alias-bg-selected,#eaf0ff)}
.dsdi-rowtext{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
.dsdi-rowtitle{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.dsdi-rowmeta{color:var(--dsw-alias-label-secondary,#8a8f99);font-size:11px;display:flex;gap:10px}
.dsdi-empty{padding:40px 16px;text-align:center;color:var(--dsw-alias-label-secondary,#8a8f99)}
.dsdi-section{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,#e4e7ec);border-radius:10px;background:var(--dsw-alias-bg-layer-2,#fafbfc);flex-shrink:0}
.dsdi-sectiontitle{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#1f2329)}
.dsdi-sectionhead{display:flex;align-items:center;justify-content:space-between;gap:10px}
.dsdi-sectionbody{display:flex;flex-direction:column;gap:6px}
.dsdi-sectionempty{color:var(--dsw-alias-label-secondary,#8a8f99);font-size:12px;padding:8px 0}
.dsdi-optlabel{color:var(--dsw-alias-label-secondary,#8a8f99)}
.dsdi-dialognote{font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);line-height:1.5;margin-bottom:2px}
.dsdi-desc{font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);line-height:1.5}
.dsdi-estimate{min-height:34px;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);line-height:1.5}
.dsdi-warn{font-size:12px;line-height:1.5;color:var(--dsw-alias-state-warning-primary,#92400e);background:var(--dsw-alias-bg-warning,#fffbeb);border:1px solid var(--dsw-alias-border-warning,#f59e0b);border-radius:8px;padding:6px 10px}
.dsdi-option{display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-size:12px;line-height:1.5}
.dsdi-option input{margin-top:2px}
.dsdi-field{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);min-height:30px}
.dsdi-promptblock{display:flex;flex-direction:column;gap:5px;padding:2px 0 0}
.dsdi-prompthead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);min-height:28px}
.dsdi-prompttext{display:block;width:100%;min-height:92px;max-height:220px;resize:vertical;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-family:inherit;font-size:12px;line-height:1.6;outline:none;box-sizing:border-box}
.dsdi-prompttext:focus{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.dsdi-promptmeta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary,#8a8f99)}
.dsdi-promptnote{font-size:11px;line-height:1.5;color:var(--dsw-alias-label-secondary,#8a8f99)}
.dsdi-num{width:76px;height:28px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:12px;padding:0 8px;box-sizing:border-box}
.dsdi-select{height:28px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:12px;padding:0 8px}
.dsdi-footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap;flex-shrink:0}
.dsdi-recent{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99);flex-shrink:0}
.dsdi-chip{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1,#d9dce1);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:12px;cursor:pointer}
.dsdi-chip:hover{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}
.dsdi-err{color:var(--dsw-alias-state-error-primary,#d1242f);font-size:12px;white-space:pre-wrap}
.dsdi-errorbox{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:12px;color:var(--dsw-alias-state-error-primary,#d1242f)}
.dsdi-detailtext{font-size:11px;color:#8a8f99;background:#f7f8fa;border:1px solid #eef0f3;border-radius:8px;padding:6px 10px;white-space:pre-wrap;word-break:break-all}
.dsdi-jobdetail{font-size:11px;color:#8a8f99;margin-top:6px}
.dsdi-jobdetailtext{margin-top:4px;white-space:pre-wrap;word-break:break-all;color:#4b5563}
.dsdi-result{font-size:12px;color:var(--dsw-alias-label-secondary,#8a8f99)}
.dsdi-ellipsis{max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-ver-btn{border:none;background:none;color:#4d6bfe;font-size:14px;cursor:pointer;padding:0 4px;line-height:1}
.dsdi-ver-btn:disabled{opacity:.3;cursor:default}
.dsdi-ver-label{white-space:nowrap}
.dsdi-ver-loading{color:#8a8f99}
.dsdi-dialog-layer{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center}
.dsdi-dialog-backdrop{position:absolute;inset:0;background:rgba(15,18,25,.45)}
.dsdi-dialog{position:relative;width:min(1100px,92vw);height:min(760px,86vh);background:#fff;border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden}
.dsdi-dialog.small{width:min(480px,92vw);height:auto;max-height:86vh}
.dsdi-cancel-body{padding:16px 18px 6px}
.dsdi-cancel-line{font-size:13px;color:#1f2329;line-height:1.7}
.dsdi-cancel-note{margin-top:10px;padding-top:10px;border-top:1px solid #eef0f3;font-size:12.5px;color:#4b5563;line-height:1.7;display:flex;flex-direction:column;gap:4px}
.dsdi-cancel-foot{padding:0 18px 12px;font-size:11px;color:#8a8f99}
.dsdi-btn.danger{color:#b3261e;border-color:#f0c2bf}
.dsdi-btn.danger:hover{border-color:#b3261e}
.dsdi-dialog-header{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #e6e9ee;flex-shrink:0}
.dsdi-dialog-title{font-size:16px;font-weight:600;color:#1f2329}
.dsdi-dialog-sub{font-size:13px;color:#8a8f99;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-dialog-search{display:flex;align-items:center;gap:6px}
.dsdi-dialog-searchinput{width:220px;height:30px;border-radius:8px;border:1px solid #d9dce1;padding:0 10px;font-size:12px;box-sizing:border-box;color:#1f2329}
.dsdi-dialog-matchcount{font-size:11px;color:#8a8f99;min-width:44px;text-align:center}
.dsdi-mini-btn{width:26px;height:26px;border-radius:6px;border:1px solid #d9dce1;background:#fff;color:#1f2329;cursor:pointer}
.dsdi-mini-btn:disabled{opacity:.35;cursor:default}
.dsdi-dialog-filter{display:flex;align-items:center;gap:6px;font-size:12px;color:#1f2329;white-space:nowrap}
.dsdi-dialog-close{width:30px;height:30px;border-radius:8px;border:1px solid #d9dce1;background:#fff;font-size:18px;line-height:1;cursor:pointer;color:#1f2329}
.dsdi-dialog-body{flex:1 1 auto;display:flex;min-height:0}
.dsdi-dialog-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;min-height:0}
.dsdi-load-earlier{align-self:center;margin:8px 0 0;border:none;background:none;color:#4d6bfe;font-size:12px;cursor:pointer;padding:4px 8px;border-radius:6px;flex-shrink:0}
.dsdi-load-earlier:disabled{opacity:.5}
.dsdi-dialog-list{flex:1 1 auto;overflow:auto;padding:8px 0}
.dsdi-dialog-row{box-sizing:border-box;padding:8px 18px}
.dsdi-dialog-row.user .dsdi-dialog-rowmeta{justify-content:flex-end}
.dsdi-dialog-row.user .dsdi-dialog-bubble{margin-left:auto;background:#4d6bfe;color:#fff;border-radius:12px 12px 2px 12px}
.dsdi-dialog-row.user .dsdi-dialog-rowactions{justify-content:flex-end}
.dsdi-dialog-rowmeta{display:flex;align-items:center;gap:8px;font-size:11px;color:#8a8f99;margin-bottom:4px}
.dsdi-dialog-role{font-size:11px;padding:0 7px;border-radius:999px;border:1px solid #d9dce1;color:#1f2329}
.dsdi-dialog-role.user{border-color:#4d6bfe;color:#4d6bfe}
.dsdi-dialog-versions{color:#8a8f99}
.dsdi-dialog-bubble{max-width:72%;background:#f2f4f7;border-radius:12px 12px 12px 2px;padding:8px 12px;font-size:13px;line-height:19px;color:#1f2329;overflow:hidden;word-break:break-word}
.dsdi-dialog-bubbletext{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-height:38px;word-break:break-word}
.dsdi-dialog-rowactions{display:flex;align-items:center;gap:10px;margin-top:6px;font-size:12px}
.dsdi-link-btn{border:none;background:none;color:#4d6bfe;font-size:12px;cursor:pointer;padding:0}
.dsdi-dialog-switch{display:inline-flex;align-items:center;gap:6px;border:1px solid #4d6bfe;border-radius:999px;padding:1px 6px}
.dsdi-ver-label-btn{border:none;background:none;color:#4d6bfe;font-size:12px;cursor:pointer;padding:0 4px;white-space:nowrap}
.dsdi-ver-label-btn::after{content:'';display:inline-block;margin-left:4px;width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;border-top:4px solid currentColor;vertical-align:middle}
.dsdi-ver-label-btn:disabled{opacity:.4;cursor:default}
.dsdi-ver-loading{color:#8a8f99;font-size:11px;margin-left:4px}
.dsdi-dialog-side{width:320px;flex:0 0 320px;border-left:1px solid #e6e9ee;display:flex;flex-direction:column;min-height:0;background:#fff}
.dsdi-side-title{padding:12px 14px 2px;font-size:13px;font-weight:600;color:#1f2329}
.dsdi-side-hint{padding:0 14px 8px;font-size:11px;color:#8a8f99}
.dsdi-side-list{flex:1 1 auto;overflow:auto}
.dsdi-side-card{display:flex;flex-direction:column;gap:3px;text-align:left;border:1px solid #e8ebf0;border-radius:8px;background:#fff;padding:6px 9px;cursor:pointer;box-sizing:border-box;width:calc(100% - 20px);margin:3px 10px 0}
.dsdi-side-card:hover{background:#f7f9ff;border-color:#c9d4ff}
.dsdi-side-card-title{font-size:12px;color:#1f2329}
.dsdi-side-card-line{font-size:11px;color:#8a8f99;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-side-card-line.selected{color:#4d6bfe}
.dsdi-side-count{padding:8px 14px;font-size:11px;color:#8a8f99;border-top:1px solid #eef0f3}
.dsdi-dialog-footer{display:flex;align-items:center;gap:10px;padding:12px 18px;border-top:1px solid #e6e9ee;flex-shrink:0}
.dsdi-dialog-selected{flex:1 1 auto;font-size:13px;color:#1f2329;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-dialog-error{font-size:12px;color:#d1242f;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-dialog-empty{flex:1 1 auto;display:flex;align-items:center;justify-content:center;color:#8a8f99;font-size:13px}
.dsdi-version-menu{position:absolute;width:360px;max-height:320px;overflow:auto;background:#fff;border:1px solid #d9dce1;border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.16);padding:6px;z-index:5}
.dsdi-version-menuitem{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;border:none;background:none;padding:6px 8px;border-radius:6px;cursor:pointer}
.dsdi-version-menuitem:hover{background:#f2f5ff}
.dsdi-version-menuitem.selected{background:#eef2ff}
.dsdi-version-menutitle{font-size:11px;color:#8a8f99}
.dsdi-version-menupreview{font-size:12px;color:#1f2329;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-detail-layer{position:absolute;inset:0;z-index:10}
.dsdi-detail{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(640px,86%);max-height:76%;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden}
.dsdi-detail-header{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e6e9ee}
.dsdi-detail-title{font-size:14px;font-weight:600;color:#1f2329;flex:1 1 auto}
.dsdi-detail-text{padding:14px 16px;font-size:13px;line-height:1.6;color:#1f2329;overflow:auto;white-space:pre-wrap;word-break:break-word}
.dsdi-detail-versions{border-top:1px solid #eef0f3;padding:10px 16px 14px;max-height:220px;overflow:auto}
.dsdi-detail-subtitle{font-size:12px;color:#8a8f99;margin-bottom:6px}
.dsdi-detail-version{display:flex;flex-direction:column;gap:2px;width:100%;text-align:left;border:1px solid #e8ebf0;border-radius:8px;background:#fff;padding:6px 8px;margin-bottom:6px;cursor:pointer}
.dsdi-detail-version.selected{border-color:#4d6bfe;background:#eef2ff}
.dsdi-detail-preview{font-size:11px;color:#8a8f99;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsdi-parse{display:flex;align-items:center;gap:10px;flex-shrink:0}
.dsdi-parselabel{font-size:12px;color:#8a8f99;white-space:nowrap}
.dsdi-parsebar{flex:1 1 auto;height:6px;border-radius:3px;background:#e4e7ec;overflow:hidden;min-width:80px}
.dsdi-parsefill{height:100%;background:#4d6bfe;border-radius:3px;transition:width .2s}
.dsdi-parsepercent{font-size:12px;color:#8a8f99;min-width:38px;text-align:right;font-variant-numeric:tabular-nums}
`
