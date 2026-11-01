/* Kizuna Rope community, text-only beta. Public browser key; never use a service key here. */
'use strict';
(function () {
  const PROJECT_URL = 'https://uslqpotfpvrqmmhbeswz.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_g0Ua4A18ZIEcLh3VZKL8ng_QYCOo5v-';
  const $ = id => document.getElementById(id);
  const s = {user:null, profile:null, posts:[], people:{}, comments:[], mode:'login', serial:0};
  let client;
  function show(id) {
    ['auth','onboarding','community'].forEach(name => $(name).hidden = name !== id);
  }
  function notice(message, kind) {
    const el=$('status'); el.textContent=message||''; el.className='status'+(kind?' '+kind:'');
  }
  function errMessage(error) {
    if (!error) return 'No fue posible completar la operación.';
    if (error.code === 'email_not_confirmed') return 'Confirma primero tu correo electrónico y vuelve a iniciar sesión.';
    if (error.code === 'invalid_credentials') return 'Correo o contraseña incorrectos.';
    if (error.code === 'user_already_exists') return 'Ese correo ya tiene cuenta. Intenta iniciar sesión.';
    return error.message || 'No fue posible completar la operación.';
  }
  function busy(form, value) {
    Array.from(form.querySelectorAll('button,input,textarea')).forEach(x => x.disabled=value);
  }
  function textElement(tag, className, value) {
    const el=document.createElement(tag); if(className) el.className=className;
    el.textContent=String(value ?? ''); return el;
  }
  function renderPosts() {
    const list=$('feed'); list.replaceChildren();
    if(!s.posts.length){list.append(textElement('div','empty','Todavía no hay publicaciones. ¡La primera conversación puede comenzar contigo!'));return;}
    const byPost={}; for (const c of s.comments) (byPost[c.post_id] ||= []).push(c);
    for (const p of s.posts) {
      const article=textElement('article','post','');
      const top=textElement('div','post-top','');
      const info=textElement('div','','');
      info.append(textElement('strong','',s.people[p.author_id]||'Miembro de Kizuna Rope'));
      info.append(textElement('div','post-meta',new Date(p.created_at).toLocaleString('es-MX')));
      top.append(info);
      if (p.author_id === s.user?.id) {
        const del=textElement('button','btn secondary small','Eliminar');
        del.type='button';
        del.addEventListener('click',async()=>{
          if(!confirm('¿Eliminar esta publicación y todos sus comentarios?'))return;
          const {error}=await client.from('posts').delete().eq('id',p.id).eq('author_id',s.user.id);
          if(error)notice(errMessage(error),'error');else {notice('Publicación eliminada.','ok');await loadFeed();}
        });
        top.append(del);
      }
      article.append(top,textElement('p','post-body',p.body));
      const comments=byPost[p.id]||[];
      article.append(textElement('p','post-meta',comments.length+' comentario(s)'));
      for(const c of comments) {
        const box=textElement('div','comment','');
        box.append(textElement('strong','',s.people[c.author_id]||'Miembro'),document.createTextNode(': '+c.body));
        article.append(box);
      }
      const form=textElement('form','comment-form','');
      const input=document.createElement('input'); input.type='text';input.maxLength=350;input.required=true;input.placeholder='Escribe un comentario respetuoso';input.setAttribute('aria-label','Escribir comentario');
      const send=textElement('button','btn small','Enviar');send.type='submit';form.append(input,send);
      form.addEventListener('submit',async ev=>{
        ev.preventDefault();const body=input.value.trim();if(!body)return;
        busy(form,true);
        try {
          const {error}=await client.from('comments').insert({post_id:p.id,author_id:s.user.id,body});
          if(error)throw error;
          notice('Comentario compartido.','ok'); await loadFeed();
        }catch(e){notice(errMessage(e),'error')}finally{busy(form,false)}
      });
      article.append(form);list.append(article);
    }
  }
  async function loadFeed() {
    if(!s.user)return;
    const {data:posts,error}=await client.from('posts').select('id,author_id,body,created_at').order('created_at',{ascending:false}).limit(100);
    if(error){notice('No se pudieron cargar las publicaciones: '+errMessage(error),'error');return;}
    s.posts=posts||[];
    const ids=s.posts.map(x=>x.id);
    const [people,comments]=await Promise.all([
      client.from('profiles').select('id,nickname').limit(1000),
      ids.length?client.from('comments').select('id,post_id,author_id,body,created_at').in('post_id',ids).order('created_at',{ascending:true}).limit(500):Promise.resolve({data:[],error:null})
    ]);
    if(people.error||comments.error){notice('No se pudo cargar toda la comunidad. Actualiza para reintentar.','error');return;}
    s.people={};(people.data||[]).forEach(p=>s.people[p.id]=p.nickname);
    s.comments=comments.data||[];renderPosts();
  }
  async function syncSession(session) {
    const serial=++s.serial;
    s.user=session?.user||null; s.profile=null;
    if(!s.user){s.posts=[];show('auth');return;}
    const {data,error}=await client.from('profiles').select('id,nickname,bio').eq('id',s.user.id).maybeSingle();
    if(serial!==s.serial)return;
    if(error){show('onboarding');notice('No se pudo recuperar tu perfil: '+errMessage(error),'error');return;}
    s.profile=data;
    if(!data){show('onboarding');notice('Completa tu perfil para empezar a publicar.');return;}
    $('welcome').textContent=data.nickname;show('community');await loadFeed();
  }
  function mode(next) {
    s.mode=next;const registration=next==='register';$('signup-rules').hidden=!registration;
    $('signup-adult').required=registration;$('signup-consent').required=registration;
    $('auth-submit').textContent=registration?'Crear cuenta':'Entrar';
    $('password').autocomplete=registration?'new-password':'current-password';
    $('tab-login').setAttribute('aria-selected',String(!registration));
    $('tab-register').setAttribute('aria-selected',String(registration));notice('');
  }
  async function initialize() {
    if(!window.supabase?.createClient){notice('No se pudo cargar el servicio de inicio de sesión. Comprueba tu conexión e inténtalo de nuevo.','error');show('auth');return;}
    client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $('tab-login').addEventListener('click',()=>mode('login'));$('tab-register').addEventListener('click',()=>mode('register'));
    $('auth-form').addEventListener('submit',async ev=>{
      ev.preventDefault();const form=ev.currentTarget;const email=$('email').value.trim();const password=$('password').value;
      if(s.mode==='register'&&(!$('signup-adult').checked||!$('signup-consent').checked)){notice('Debes confirmar tu edad y aceptar las normas.','error');return;}
      busy(form,true);
      try {
        if(s.mode==='register') {
          const result=await client.auth.signUp({email,password,options:{emailRedirectTo:location.href.split('#')[0]}});
          if(result.error)throw result.error;
          if(result.data.session){notice('Cuenta creada. Completa tu perfil.','ok');await syncSession(result.data.session);}
          else notice('Revisa tu correo para confirmar la cuenta. Después regresa aquí e inicia sesión.','ok');
        } else {
          const result=await client.auth.signInWithPassword({email,password});
          if(result.error)throw result.error;
          notice('Sesión iniciada.','ok');await syncSession(result.data.session);
        }
      } catch (e) {notice(errMessage(e),'error')} finally {busy(form,false)}
    });
    $('profile-form').addEventListener('submit',async ev=>{
      ev.preventDefault();const form=ev.currentTarget;if(!s.user)return;
      const nickname=$('nickname').value.trim();const bio=$('bio').value.trim();
      if(nickname.length<2||nickname.length>35||bio.length>320||!$('profile-adult').checked||!$('profile-rules').checked){notice('Revisa tu nombre y las normas.','error');return;}
      busy(form,true);
      try {
        const {error}=await client.from('profiles').upsert({id:s.user.id,nickname,bio,adult_self_attested:true,community_rules_accepted:true},{onConflict:'id'});
        if(error)throw error;
        s.profile={id:s.user.id,nickname,bio};$('welcome').textContent=nickname;
        notice('Perfil creado correctamente.','ok');show('community');await loadFeed();
      }catch(e){notice(errMessage(e),'error')}finally{busy(form,false)}
    });
    $('post-form').addEventListener('submit',async ev=>{
      ev.preventDefault();const form=ev.currentTarget;if(!s.user||!s.profile)return;
      const body=$('post-body').value.trim();
      if(!body||body.length>1000||!$('post-rules').checked){notice('Escribe tu publicación y confirma las normas.','error');return;}
      busy(form,true);
      try {
        const {error}=await client.from('posts').insert({author_id:s.user.id,body});
        if(error)throw error;
        form.reset();notice('Tu publicación ya está compartida en la comunidad.','ok');await loadFeed();
      }catch(e){notice(errMessage(e),'error')}finally{busy(form,false)}
    });
    const logout=async()=>{
      const {error}=await client.auth.signOut();
      if(error)notice(errMessage(error),'error');else{notice('Sesión cerrada.','ok');await syncSession(null);}
    };
    $('logout').addEventListener('click',logout);$('onboard-logout').addEventListener('click',logout);
    $('refresh').addEventListener('click',()=>{notice('Actualizando publicaciones...');loadFeed().then(()=>{if(!$('status').classList.contains('error'))notice('Comunidad actualizada.','ok')});});
    client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>{syncSession(session)},0)});
    const {data,error}=await client.auth.getSession();if(error)notice(errMessage(error),'error');else await syncSession(data.session);
  }
  initialize().catch(e=>{notice(errMessage(e),'error');show('auth')});
})();
