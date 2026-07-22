"use strict";(globalThis.webpackChunk_clerk_clerk_js=globalThis.webpackChunk_clerk_clerk_js||[]).push([["4307"],{48641:function(e,t,i){i.r(t),i.d(t,{KeylessPrompt:()=>C,getResolvedContent:()=>g,getCurrentState:()=>m});var r=i(73312),n=i(61869),o=i(65909),a=i(69144),s=i(51217),l=i(51164),d=i(11576);let c="18rem",p="cubic-bezier(0.2, 0, 0, 1)",u=(0,o.iv)`
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  background: none;
  border: none;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    avenir next,
    avenir,
    segoe ui,
    helvetica neue,
    helvetica,
    Cantarell,
    Ubuntu,
    roboto,
    noto,
    arial,
    sans-serif;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  text-decoration: none;
  color: inherit;
  appearance: none;
`;function h(e){return e?"220ms":"180ms"}let f=(0,o.iv)`
  ${u};
  margin: 0.75rem 0 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 1.75rem;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.12px;
  color: #fde047;
  text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.32);
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 30.5%, rgba(0, 0, 0, 0.05) 100%), #454545;
  box-shadow:
    0px 0px 0px 1px rgba(255, 255, 255, 0.04) inset,
    0px 1px 0px 0px rgba(255, 255, 255, 0.04) inset,
    0px 0px 0px 1px rgba(0, 0, 0, 0.12),
    0px 1.5px 2px 0px rgba(0, 0, 0, 0.48),
    0px 0px 4px 0px rgba(243, 107, 22, 0) inset;
  outline: none;
  &:hover {
    background: #4b4b4b;
    transition: background-color 120ms ease-in-out;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
  &:focus-visible {
    outline: 2px solid #6c47ff;
    outline-offset: 2px;
  }
`,x={idle:{triggerWidth:"14.25rem",title:"Configure your application",description:(0,r.BX)(r.HY,{children:[(0,r.tZ)("p",{children:"Temporary API keys are enabled so you can get started immediately."}),(0,r.tZ)("ul",{children:["Add SSO connections (eg. GitHub)","Set up B2B authentication","Enable MFA"].map(e=>(0,r.tZ)("li",{children:e},e))}),(0,r.tZ)("p",{children:"Access the dashboard to customize auth settings and explore Clerk features."})]}),cta:{kind:"link",text:"Configure your application",href:({claimUrl:e})=>e}},userCreated:{triggerWidth:"15.75rem",title:"You've created your first user!",description:(0,r.tZ)("p",{children:"Head to the dashboard to customize authentication settings, view user info, and explore more features."}),cta:{kind:"link",text:"Configure your application",href:({claimUrl:e})=>e}},claimed:{triggerWidth:"14.25rem",title:"Missing environment keys",description:(0,r.tZ)("p",{children:"You claimed this application but haven't set keys in your environment. Get them from the Clerk Dashboard."}),cta:{kind:"link",text:"Get API keys",href:({claimUrl:e})=>e}},completed:{triggerWidth:"10.5rem",title:"Your app is ready",description:({appName:e,instanceUrl:t})=>(0,r.BX)("p",{children:["Your application"," ",(0,r.tZ)("a",{href:t,target:"_blank",rel:"noopener noreferrer",children:e})," ","has been configured. You may now customize your settings in the Clerk dashboard."]}),cta:{kind:"action",text:"Dismiss",onClick:e=>{e?.().then(()=>{window.location.reload()})}}}};function m(e,t,i){return t?"completed":e?"claimed":i?"userCreated":"idle"}function g(e,t){let i=x[e],r="function"==typeof i.description?i.description({appName:t.appName,instanceUrl:t.instanceUrl}):i.description,n=i.cta,o="link"===n.kind?{kind:"link",text:n.text,href:"function"==typeof n.href?n.href({claimUrl:t.claimUrl,instanceUrl:t.instanceUrl}):n.href}:{kind:"action",text:n.text,onClick:()=>n.onClick(t.onDismiss)};return{state:e,triggerWidth:i.triggerWidth,title:i.title,description:r,cta:o}}function b(e){let t=(0,a.useId)(),i=function(){let e=(0,n.cL)(),t=(0,a.useRef)(Date.now()),[,i]=(0,a.useReducer)(e=>e+1,0);return(0,a.useEffect)(()=>{let r=new AbortController;return window.addEventListener("focus",async()=>{let n=e.__unstable__environment;if(n){if(null!==n.authConfig.claimedAt)return r.abort();if(!(Date.now()<t.current+1e4)&&"visible"===document.visibilityState)for(let e=0;e<2;e++){let{authConfig:{claimedAt:e}}=await n.fetch();if(t.current=Date.now(),null!==e){i();break}}}},{signal:r.signal}),()=>{r.abort()}},[]),(0,d.useEnvironment)()}(),s=!!i.authConfig.claimedAt,x="function"==typeof e.onDismiss&&s,{isSignedIn:b}=(0,n.aF)(),C=i.displayConfig.applicationName,v=(0,a.useMemo)(()=>{if(s)return e.copyKeysUrl;let t=new URL(e.claimUrl);return t.searchParams.append("return_url",window.location.href),t.href},[s,e.copyKeysUrl,e.claimUrl]),y=(0,a.useMemo)(()=>(function(e){try{return e()}catch{return"https://dashboard.clerk.com/last-active"}})(()=>{let t=(0,l.EA)(e.copyKeysUrl);return new URL(`${t.baseDomain}/apps/${t.appId}/instances/${t.instanceId}/user-authentication/email-phone-username`).href}),[e.copyKeysUrl]),[k,w]=(0,a.useState)(!0),Z=m(s,x,!!b),B=(0,a.useMemo)(()=>g(Z,{appName:C,instanceUrl:y,claimUrl:v,onDismiss:e.onDismiss}),[Z,C,y,v,e.onDismiss]),$="link"===B.cta.kind?(0,r.tZ)("a",{href:B.cta.href,target:"_blank",rel:"noopener noreferrer",css:f,children:B.cta.text}):(0,r.tZ)("button",{type:"button",onClick:B.cta.onClick,css:f,children:B.cta.text});return(0,r.BX)("div",{"data-expanded":k,css:(0,o.iv)`
        ${u};
        position: fixed;
        bottom: 1.25rem;
        right: 1.25rem;
        border-radius: ${k?"0.75rem":"2.5rem"};
        background-color: #1f1f1f;
        box-shadow:
          0px 0px 0px 0.5px #2f3037 inset,
          0px 1px 0px 0px rgba(255, 255, 255, 0.08) inset,
          0px 0px 0.8px 0.8px rgba(255, 255, 255, 0.2) inset,
          0px 0px 0px 0px rgba(255, 255, 255, 0.72),
          0px 16px 36px -6px rgba(0, 0, 0, 0.36),
          0px 6px 16px -2px rgba(0, 0, 0, 0.2);
        height: auto;
        isolation: isolate;
        transform: translateZ(0);
        backface-visibility: hidden;
        width: ${k?c:B.triggerWidth};
        transition:
          border-radius ${h(k)} cubic-bezier(0.2, 0, 0, 1),
          width ${h(k)} ${p};

        @media (prefers-reduced-motion: reduce) {
          transition: none;
        }
        &:has(button:focus-visible) {
          outline: 2px solid #6c47ff;
          outline-offset: 2px;
        }
        &::before {
          content: '';
          pointer-events: none;
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background-image: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%);
          opacity: 0.16;
          transition: opacity ${h(k)} ${p};

          @media (prefers-reduced-motion: reduce) {
            transition: none;
          }
        }
        &[data-expanded='true']::before,
        &:hover::before {
          opacity: 0.2;
        }
      `,children:[(0,r.BX)("button",{type:"button","aria-label":"Keyless prompt","aria-controls":t,"aria-expanded":k,onClick:()=>w(e=>!e),css:(0,o.iv)`
          ${u};
          display: flex;
          align-items: center;
          width: 100%;
          border-radius: inherit;
          padding-inline: 0.75rem;
          gap: 0.25rem;
          height: 2.5rem;
          outline: none;
          cursor: pointer;
          user-select: none;
        `,children:[(0,r.BX)("svg",{css:(0,o.iv)`
            width: 1rem;
            height: 1rem;
            flex-shrink: 0;
          `,fill:"none",viewBox:"0 0 128 128",children:[(0,r.tZ)("circle",{cx:"64",cy:"64",r:"20",fill:"#fff"}),(0,r.tZ)("path",{fill:"#fff",fillOpacity:".4",d:"M99.572 10.788c1.999 1.34 2.17 4.156.468 5.858L85.424 31.262c-1.32 1.32-3.37 1.53-5.033.678A35.846 35.846 0 0 0 64 28c-19.882 0-36 16.118-36 36a35.846 35.846 0 0 0 3.94 16.391c.851 1.663.643 3.712-.678 5.033L16.646 100.04c-1.702 1.702-4.519 1.531-5.858-.468C3.974 89.399 0 77.163 0 64 0 28.654 28.654 0 64 0c13.163 0 25.399 3.974 35.572 10.788Z"}),(0,r.tZ)("path",{fill:"#fff",d:"M100.04 111.354c1.702 1.702 1.531 4.519-.468 5.858C89.399 124.026 77.164 128 64 128c-13.164 0-25.399-3.974-35.572-10.788-2-1.339-2.17-4.156-.468-5.858l14.615-14.616c1.322-1.32 3.37-1.53 5.033-.678A35.847 35.847 0 0 0 64 100a35.846 35.846 0 0 0 16.392-3.94c1.662-.852 3.712-.643 5.032.678l14.616 14.616Z"})]}),(0,r.tZ)("span",{css:(0,o.iv)`
            ${u};
            font-size: 0.875rem;
            font-weight: 500;
            color: #d9d9d9;
            white-space: nowrap;
          `,children:B.title}),(0,r.tZ)("svg",{css:(0,o.iv)`
            width: 1rem;
            height: 1rem;
            flex-shrink: 0;
            color: #d9d9d9;
            margin-inline-start: auto;
            opacity: ${.5*!!k};
            transition: opacity ${h(k)} ease-out;

            @media (prefers-reduced-motion: reduce) {
              transition: none;
            }
            ${k&&(0,o.iv)`
              button:hover & {
                opacity: 1;
              }
            `}
          `,viewBox:"0 0 16 16",fill:"none","aria-hidden":"true",xmlns:"http://www.w3.org/2000/svg",children:(0,r.tZ)("path",{d:"M3.75 8H12.25",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})]}),(0,r.tZ)("div",{id:t,...!k&&{inert:""},css:(0,o.iv)`
          ${u};
          display: grid;
          grid-template-rows: ${k?"1fr":"0fr"};
          transition: grid-template-rows ${h(k)} ${p};

          @media (prefers-reduced-motion: reduce) {
            transition: none;
          }
        `,children:(0,r.tZ)("div",{css:(0,o.iv)`
            ${u};
            min-height: 0;
            overflow: hidden;
          `,children:(0,r.BX)("div",{css:(0,o.iv)`
              ${u};
              width: ${c};
              padding-inline: 0.75rem;
              padding-block-end: 0.75rem;
              opacity: ${+!!k};
              transition: opacity ${h(k)} ${p};

              @media (prefers-reduced-motion: reduce) {
                transition: none;
              }
            `,children:[(0,r.tZ)("div",{css:(0,o.iv)`
                ${u};
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                & ul {
                  ${u};
                  list-style: disc;
                  padding-left: 1rem;
                }
                & p,
                & li {
                  ${u};
                  color: #b4b4b4;
                  font-size: 0.8125rem;
                  font-weight: 400;
                  line-height: 1rem;
                  text-wrap: pretty;
                }
                & a {
                  color: #fde047;
                  font-weight: 500;
                  outline: none;
                  text-decoration: underline;
                  &:focus-visible {
                    outline: 2px solid #6c47ff;
                    outline-offset: 2px;
                  }
                }
              `,children:B.description}),$]})})})]})}function C(e){return(0,r.tZ)(s.InternalThemeProvider,{children:(0,r.tZ)(b,{...e})})}},51164:function(e,t,i){i.d(t,{EA:()=>d,H8:()=>l,Ui:()=>s,Xz:()=>c,lc:()=>a});var r=i(73312),n=i(65909),o=i(64204);function a({children:e,sx:t,...i}){return(0,r.tZ)(o.Flex,{sx:e=>[{borderRadius:"1.25rem",fontFamily:e.fonts.$main,background:"linear-gradient(180deg, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 100%), #1f1f1f",boxShadow:"0px 0px 0px 0.5px #2F3037 inset, 0px 1px 0px 0px rgba(255, 255, 255, 0.08) inset, 0px 0px 0.8px 0.8px rgba(255, 255, 255, 0.20) inset, 0px 0px 0px 0px rgba(255, 255, 255, 0.72), 0px 16px 36px -6px rgba(0, 0, 0, 0.36), 0px 6px 16px -2px rgba(0, 0, 0, 0.20);"},t],...i,children:e})}let s=(0,n.iv)`
  box-sizing: border-box;
  padding: 0;
  margin: 0;
  background: none;
  border: none;
  line-height: 1.5;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    avenir next,
    avenir,
    segoe ui,
    helvetica neue,
    helvetica,
    Cantarell,
    Ubuntu,
    roboto,
    noto,
    arial,
    sans-serif;
  text-decoration: none;
`;function l(e){return(0,r.tZ)("svg",{...e,viewBox:"0 0 16 17",fill:"none","aria-hidden":!0,xmlns:"http://www.w3.org/2000/svg",children:(0,r.BX)("g",{opacity:"0.88",children:[(0,r.tZ)("path",{d:"M13.8002 8.20039C13.8002 8.96206 13.6502 9.71627 13.3587 10.42C13.0672 11.1236 12.64 11.763 12.1014 12.3016C11.5628 12.8402 10.9234 13.2674 10.2198 13.5589C9.51607 13.8504 8.76186 14.0004 8.0002 14.0004C7.23853 14.0004 6.48432 13.8504 5.78063 13.5589C5.07694 13.2674 4.43756 12.8402 3.89898 12.3016C3.3604 11.763 2.93317 11.1236 2.64169 10.42C2.35022 9.71627 2.2002 8.96206 2.2002 8.20039C2.2002 6.66214 2.81126 5.18688 3.89898 4.09917C4.98669 3.01146 6.46194 2.40039 8.0002 2.40039C9.53845 2.40039 11.0137 3.01146 12.1014 4.09917C13.1891 5.18688 13.8002 6.66214 13.8002 8.20039Z",fill:"#22C543",fillOpacity:"0.16"}),(0,r.tZ)("path",{d:"M6.06686 8.68372L7.51686 10.1337L9.93353 6.75039M13.8002 8.20039C13.8002 8.96206 13.6502 9.71627 13.3587 10.42C13.0672 11.1236 12.64 11.763 12.1014 12.3016C11.5628 12.8402 10.9234 13.2674 10.2198 13.5589C9.51607 13.8504 8.76186 14.0004 8.0002 14.0004C7.23853 14.0004 6.48432 13.8504 5.78063 13.5589C5.07694 13.2674 4.43756 12.8402 3.89898 12.3016C3.3604 11.763 2.93317 11.1236 2.64169 10.42C2.35022 9.71627 2.2002 8.96206 2.2002 8.20039C2.2002 6.66214 2.81126 5.18688 3.89898 4.09917C4.98669 3.01146 6.46194 2.40039 8.0002 2.40039C9.53845 2.40039 11.0137 3.01146 12.1014 4.09917C13.1891 5.18688 13.8002 6.66214 13.8002 8.20039Z",stroke:"#22C543",strokeWidth:"1.2",strokeLinecap:"round",strokeLinejoin:"round"})]})})}function d(e){let t=new URL(e).href.match(/^https?:\/\/(.*?)\/apps\/app_(.+?)\/instances\/ins_(.+?)(?:\/.*)?$/);if(!t)throw Error("Invalid value Dashboard URL structure");return{baseDomain:`https://${t[1]}`,appId:`app_${t[2]}`,instanceId:`ins_${t[3]}`}}function c(){return(0,r.BX)("svg",{width:"1rem",height:"1.25rem",viewBox:"0 0 16 20",fill:"none","aria-hidden":!0,xmlns:"http://www.w3.org/2000/svg",children:[(0,r.BX)("g",{filter:"url(#filter0_i_438_501)",children:[(0,r.tZ)("path",{d:"M10.4766 9.99979C10.4766 11.3774 9.35978 12.4942 7.98215 12.4942C6.60452 12.4942 5.48773 11.3774 5.48773 9.99979C5.48773 8.62216 6.60452 7.50537 7.98215 7.50537C9.35978 7.50537 10.4766 8.62216 10.4766 9.99979Z",fill:"#BBBBBB"}),(0,r.tZ)("path",{d:"M12.4176 3.36236C12.6676 3.52972 12.6889 3.88187 12.4762 4.09457L10.6548 5.91595C10.4897 6.08107 10.2336 6.10714 10.0257 6.00071C9.41273 5.68684 8.71811 5.50976 7.98214 5.50976C5.5024 5.50976 3.49219 7.51998 3.49219 9.99972C3.49219 10.7357 3.66926 11.4303 3.98314 12.0433C4.08957 12.2511 4.06349 12.5073 3.89837 12.6724L2.07699 14.4938C1.86429 14.7065 1.51215 14.6851 1.34479 14.4352C0.495381 13.1666 0 11.641 0 9.99972C0 5.5913 3.57373 2.01758 7.98214 2.01758C9.62345 2.01758 11.1491 2.51296 12.4176 3.36236Z",fill:"#8F8F8F"}),(0,r.tZ)("path",{d:"M12.4762 15.905C12.6889 16.1177 12.6675 16.4698 12.4176 16.6372C11.149 17.4866 9.62342 17.982 7.9821 17.982C6.34078 17.982 4.81516 17.4866 3.54661 16.6372C3.29666 16.4698 3.27531 16.1177 3.48801 15.905L5.30938 14.0836C5.4745 13.9185 5.73066 13.8924 5.93851 13.9988C6.55149 14.3127 7.24612 14.4898 7.9821 14.4898C8.71808 14.4898 9.4127 14.3127 10.0257 13.9988C10.2335 13.8924 10.4897 13.9185 10.6548 14.0836L12.4762 15.905Z",fill:"#BBBBBB"})]}),(0,r.tZ)("defs",{children:(0,r.BX)("filter",{id:"filter0_i_438_501",x:"0",y:"1.86758",width:"12.6217",height:"16.1144",filterUnits:"userSpaceOnUse",colorInterpolationFilters:"sRGB",children:[(0,r.tZ)("feFlood",{floodOpacity:"0",result:"BackgroundImageFix"}),(0,r.tZ)("feBlend",{mode:"normal",in:"SourceGraphic",in2:"BackgroundImageFix",result:"shape"}),(0,r.tZ)("feColorMatrix",{in:"SourceAlpha",type:"matrix",values:"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0",result:"hardAlpha"}),(0,r.tZ)("feOffset",{dy:"-0.15"}),(0,r.tZ)("feGaussianBlur",{stdDeviation:"0.15"}),(0,r.tZ)("feComposite",{in2:"hardAlpha",operator:"arithmetic",k2:"-1",k3:"1"}),(0,r.tZ)("feColorMatrix",{type:"matrix",values:"0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"}),(0,r.tZ)("feBlend",{mode:"normal",in2:"shape",result:"effect1_innerShadow_438_501"})]})})]})}}}]);