'use client'

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  Bot,
  ChevronDown,
  CircleDot,
  Gauge,
  Inbox,
  LockKeyhole,
  Network,
  Play,
  Send,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react'
import styles from './page.module.css'

const heroStates = [
  {
    label: 'Campaign launched',
    metric: '18,420',
    caption: 'Messages sent',
    data: [
      { name: '9 AM', value: 24 },
      { name: '10 AM', value: 38 },
      { name: '11 AM', value: 56 },
      { name: '12 PM', value: 82 },
      { name: '1 PM', value: 97 },
    ],
  },
  {
    label: 'Customers reading',
    metric: '91.8%',
    caption: 'Read rate',
    data: [
      { name: '9 AM', value: 18 },
      { name: '10 AM', value: 48 },
      { name: '11 AM', value: 64 },
      { name: '12 PM', value: 79 },
      { name: '1 PM', value: 92 },
    ],
  },
  {
    label: 'Replies increasing',
    metric: '2,341',
    caption: 'Qualified replies',
    data: [
      { name: '9 AM', value: 12 },
      { name: '10 AM', value: 22 },
      { name: '11 AM', value: 44 },
      { name: '12 PM', value: 61 },
      { name: '1 PM', value: 84 },
    ],
  },
  {
    label: 'Conversions detected',
    metric: '386',
    caption: 'Hot leads',
    data: [
      { name: '9 AM', value: 9 },
      { name: '10 AM', value: 18 },
      { name: '11 AM', value: 36 },
      { name: '12 PM', value: 52 },
      { name: '1 PM', value: 73 },
    ],
  },
]

const activityCards = [
  'New reply received from Ravi',
  'AI qualified a high-intent lead',
  'Campaign reached 4,821 customers',
  'Demo booked automatically',
]

const videoChapters = [
  {
    label: '01 - Campaigns',
    title: 'Launch campaigns that feel personal, not mass-produced.',
    description:
      'Select contacts, use approved WhatsApp templates, schedule sends, and monitor delivery, reads and replies in one place.',
    video: '/videos/metawhat-import-broadcast.mp4',
    tag: 'Campaign -> Delivered -> Read -> Replied',
  },
  {
    label: '02 - Shared Inbox',
    title: 'Every customer conversation, finally in one place.',
    description:
      'Teams can assign chats, add notes, view contact data, and continue conversations without switching between personal phones.',
    video: '/videos/metawhat-import-broadcast.mp4',
    tag: 'Inbox -> Assign -> Resolve',
  },
  {
    label: '03 - AI Agent',
    title: 'An AI agent that knows when to help and when to hand over.',
    description:
      'Answer questions, qualify leads, collect details, create summaries, trigger follow-ups and pass serious buyers to humans.',
    video: '/videos/metawhat-chatbot-builder.mp4',
    tag: 'AI -> Lead score -> Handoff',
    accent: 'ai',
  },
  {
    label: '04 - Automation & Analytics',
    title: 'Build the workflow once. Let MetaWhat run it continuously.',
    description:
      'Trigger a template, wait for replies, branch by intent, tag the contact, notify the team, and measure each step.',
    video: '/videos/metawhat-chatbot-builder.mp4',
    tag: 'Trigger -> Condition -> Conversion',
  },
]

const featureCards = [
  {
    title: 'Campaigns',
    copy: 'Segments, approved templates, scheduling and delivery progress.',
    icon: Send,
    size: 'large',
  },
  {
    title: 'Shared team inbox',
    copy: 'Assign owners, add notes, tag contacts and reply as a team.',
    icon: Inbox,
  },
  {
    title: 'AI Agent',
    copy: 'Intent, lead score, next action and summary in one intelligence panel.',
    icon: Bot,
    accent: true,
  },
  {
    title: 'Workflow automation',
    copy: 'Trigger, wait, condition, AI, tag, handoff and track.',
    icon: Workflow,
  },
  {
    title: 'Contacts and CRM',
    copy: 'Lifecycle, tags, owners, opt-ins and customer history.',
    icon: Users,
  },
  {
    title: 'Real-time analytics',
    copy: 'Sent, delivered, read, replied, clicked and converted.',
    icon: Gauge,
  },
]

const automationSteps = [
  'New lead',
  'Send WhatsApp message',
  'Wait for response',
  'AI understands intent',
  'Lead qualified',
  'Demo booked',
  'Human handoff',
]

const integrations = [
  ['WhatsApp', 'Official messaging channel'],
  ['Google Sheets', 'Save leads and rows'],
  ['Google Calendar', 'Book demos from chat'],
  ['Gmail', 'Notify teams instantly'],
  ['Shopify', 'Recover cart conversations'],
  ['Zapier', 'Connect no-code tools'],
  ['Webhooks', 'Trigger your backend'],
  ['Custom API', 'Build your own flows'],
]

const solutions = [
  ['Generate more sales', 'Campaigns, lead qualification and smart follow-ups.'],
  ['Support customers faster', 'Shared inbox, AI assistance and team assignment.'],
  ['Automate repetitive work', 'Visual workflows, templates, APIs and integrations.'],
  ['Understand performance', 'Real-time messaging and conversion analytics.'],
]

const testimonials = [
  {
    quote: 'Our team now handles WhatsApp leads from one inbox instead of personal phones.',
    result: '42% faster response time',
    name: 'Operations Lead',
  },
  {
    quote: 'Automated follow-ups recovered leads we were previously losing.',
    result: '31% more conversations reopened',
    name: 'Sales Manager',
  },
  {
    quote: 'The AI summary before handoff helps our agents understand customers in seconds.',
    result: '2.4x faster handoff',
    name: 'Support Head',
  },
]

const faqs = [
  ['What is MetaWhat?', 'MetaWhat is a WhatsApp Growth OS for campaigns, inbox, AI, automation, analytics and team workflows.'],
  ['Does it use the official WhatsApp Business API?', 'Yes. It is designed around official WhatsApp Business API connectivity and Meta-approved templates.'],
  ['Can multiple team members manage conversations?', 'Yes. The shared inbox supports assignment, notes, tags, customer context and handoff.'],
  ['Can I create WhatsApp automation workflows?', 'Yes. MetaWhat includes a visual workflow builder for triggers, templates, conditions, AI and human handoff.'],
  ['Can the AI agent hand conversations to humans?', 'Yes. AI can qualify, summarize and hand over conversations to the right team member.'],
  ['Can I track delivery, reads and replies?', 'Yes. Analytics can track sent, delivered, read, replied, clicked and converted activity.'],
]

const chartTicks = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function useRotatingIndex(length: number, delay = 3200) {
  const [index, setIndex] = useState(0)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion || length <= 1) return

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % length)
    }, delay)

    return () => window.clearInterval(timer)
  }, [delay, length, reducedMotion])

  return [index, setIndex] as const
}

function useHomepageGsap(pageRef: RefObject<HTMLElement | null>) {
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion || !pageRef.current) return

    let cancelled = false
    let cleanup = () => {}

    async function setupGsap() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ])

      if (cancelled || !pageRef.current) return

      gsap.registerPlugin(ScrollTrigger)

      const ctx = gsap.context(() => {
        gsap.from('[data-gsap="nav"]', {
          y: -16,
          autoAlpha: 0,
          duration: 0.6,
          ease: 'power3.out',
        })

        gsap.to('[data-gsap="nav"]', {
          minHeight: 58,
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          boxShadow: '0 16px 54px rgba(7, 26, 53, 0.13)',
          scrollTrigger: {
            start: 30,
            end: 180,
            scrub: true,
          },
        })

        gsap
          .timeline({ defaults: { duration: 0.68, ease: 'power3.out' } })
          .from('[data-gsap="hero-badge"]', { autoAlpha: 0, y: 16 })
          .from(
            '[data-gsap="hero-title"]',
            { autoAlpha: 0, y: 26, clipPath: 'inset(0 0 100% 0)' },
            '-=0.36',
          )
          .from('[data-gsap="hero-copy"]', { autoAlpha: 0, y: 18 }, '-=0.32')
          .from('[data-gsap="hero-actions"]', { autoAlpha: 0, y: 18 }, '-=0.32')
          .from('[data-gsap="hero-system"]', { autoAlpha: 0, y: 34, scale: 0.98 }, '-=0.46')
          .from('[data-gsap="hero-chart"]', { autoAlpha: 0, y: 14 }, '-=0.34')

        gsap.utils.toArray<HTMLElement>('[data-counter-to]').forEach((counter) => {
          const target = Number(counter.dataset.counterTo ?? '0')
          const suffix = counter.dataset.counterSuffix ?? ''
          const decimals = target % 1 === 0 ? 0 : 1
          const state = { value: 0 }

          ScrollTrigger.create({
            trigger: counter,
            start: 'top 82%',
            once: true,
            onEnter: () => {
              gsap.to(state, {
                value: target,
                duration: 1.35,
                ease: 'power2.out',
                onUpdate: () => {
                  counter.textContent = `${state.value.toFixed(decimals)}${suffix}`
                },
              })
            },
          })
        })

        const workflowNodes = gsap.utils.toArray<HTMLElement>('[data-gsap="workflow-node"]')
        gsap.set(workflowNodes, { autoAlpha: 0.45, y: 16 })

        gsap
          .timeline({
            scrollTrigger: {
              trigger: '[data-gsap="automation-section"]',
              start: 'top 72%',
              end: 'bottom 62%',
              scrub: 0.7,
            },
          })
          .to(workflowNodes, { autoAlpha: 1, y: 0, stagger: 0.14, ease: 'power2.out' }, 0)
          .to('[data-gsap="workflow-packet"]', { left: '94%', ease: 'none' }, 0)
      }, pageRef.current)

      cleanup = () => ctx.revert()
      ScrollTrigger.refresh()
    }

    void setupGsap()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [pageRef, reducedMotion])
}

function SectionReveal({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function Navbar() {
  const [openMenu, setOpenMenu] = useState<'product' | 'solutions' | null>(null)

  return (
    <header className={styles.navWrap}>
      <nav className={styles.nav} data-gsap="nav" aria-label="Primary navigation">
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark}>
            <Image src="/brand/metawhat-mark.png" alt="" width={32} height={32} priority />
          </span>
          <span>metawhat</span>
        </Link>

        <div className={styles.navLinks}>
          {[
            ['Product', 'product'],
            ['Solutions', 'solutions'],
          ].map(([label, key]) => (
            <button
              className={styles.navMenuButton}
              key={key}
              type="button"
              onClick={() => setOpenMenu(openMenu === key ? null : (key as 'product' | 'solutions'))}
            >
              {label}
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ))}
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#integrations">Integrations</a>
          <a href="#resources">Resources</a>
        </div>

        <div className={styles.navActions}>
          <Link href="/sign-in">Log in</Link>
          <Link className={styles.navCta} href="/sign-up">
            Start for free
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <AnimatePresence>
          {openMenu && (
            <motion.div
              className={styles.megaMenu}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.18 }}
            >
              {(openMenu === 'product'
                ? ['Campaigns', 'Team inbox', 'AI Agent', 'Workflow automation']
                : ['Sales', 'Marketing', 'Customer support', 'Operations']
              ).map((item) => (
                <Link href="/sign-up" key={item} onClick={() => setOpenMenu(null)}>
                  <strong>{item}</strong>
                  <span>Explore MetaWhat for {item.toLowerCase()}</span>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  )
}

function HeroDashboard() {
  const [active] = useRotatingIndex(heroStates.length)
  const [activity] = useRotatingIndex(activityCards.length, 2600)
  const state = heroStates[active]

  return (
    <div className={styles.liveSystem}>
      <div className={styles.systemHeader}>
        <span>
          <CircleDot className="h-4 w-4" aria-hidden="true" />
          {state.label}
        </span>
        <em>Live</em>
      </div>

      <div className={styles.metricPanel}>
        <div>
          <small>{state.caption}</small>
          <strong>{state.metric}</strong>
        </div>
        <div className={styles.miniStats}>
          <span>Delivery 98.2%</span>
          <span>Replies +28%</span>
        </div>
      </div>

      <div className={styles.chartPanel} data-gsap="hero-chart">
        <ResponsiveContainer width="100%" height={210}>
          <AreaChart data={state.data}>
            <defs>
              <linearGradient id="heroChart" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0F9488" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#0F9488" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(7,26,53,0.06)" vertical={false} />
            <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
            <YAxis hide domain={[0, 100]} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(7,26,53,0.08)' }} />
            <Area type="monotone" dataKey="value" stroke="#0F9488" strokeWidth={3} fill="url(#heroChart)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.flowRail} aria-hidden="true">
        {['Customer', 'WhatsApp', 'MetaWhat', 'AI', 'Team'].map((item) => (
          <span key={item}>{item}</span>
        ))}
        <i />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          className={styles.activityToast}
          key={activity}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -18 }}
          transition={{ duration: 0.28 }}
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {activityCards[activity]}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <motion.div
          className={styles.heroCopy}
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.1 } },
          }}
        >
          <motion.span
            className={styles.badge}
            data-gsap="hero-badge"
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
          >
            The WhatsApp Growth OS
          </motion.span>
          <motion.h1
            data-gsap="hero-title"
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }}
          >
            Turn every WhatsApp conversation into growth.
          </motion.h1>
          <motion.p
            data-gsap="hero-copy"
            variants={{ hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0 } }}
          >
            Campaigns, AI, automation, support and analytics working together in one serious
            WhatsApp operating system for modern teams.
          </motion.p>
          <motion.div
            className={styles.heroActions}
            data-gsap="hero-actions"
            variants={{ hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } }}
          >
            <Link className={styles.primaryButton} href="/sign-up">
              Start for free
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a className={styles.secondaryButton} href="#product-story">
              See MetaWhat in action
              <Play className="h-4 w-4" aria-hidden="true" />
            </a>
          </motion.div>
          <motion.small variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
            Connect your business. No credit card required.
          </motion.small>
        </motion.div>

        <motion.div
          data-gsap="hero-system"
          initial={{ opacity: 0, y: 34, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <HeroDashboard />
        </motion.div>
      </div>
    </section>
  )
}

function TrustSection() {
  return (
    <section className={styles.trustSection}>
      <SectionReveal className={styles.trustInner}>
        <p>Built for teams that run business on WhatsApp</p>
        <div className={styles.logoRow}>
          {['Tally teams', 'Sales teams', 'Support desks', 'Marketing teams', 'Operations'].map((logo) => (
            <span key={logo}>{logo}</span>
          ))}
        </div>
        <div className={styles.proofGrid}>
          {[
            { value: '10M+', label: 'Messages processed', target: '10', suffix: 'M+' },
            { value: '99.9%', label: 'Platform uptime target', target: '99.9', suffix: '%' },
            { value: '24/7', label: 'Automation running', target: '24', suffix: '/7' },
          ].map(({ value, label, target, suffix }) => (
            <div key={label}>
              <strong data-counter-to={target} data-counter-suffix={suffix}>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </SectionReveal>
    </section>
  )
}

function ProductVideoStory() {
  const [activeChapter, setActiveChapter] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const storyRef = useRef<HTMLElement | null>(null)
  const reducedMotion = useReducedMotion()
  const active = videoChapters[activeChapter]

  useEffect(() => {
    if (!videoRef.current) return
    videoRef.current.load()
    if (!reducedMotion) {
      void videoRef.current.play().catch(() => undefined)
    }
  }, [activeChapter, reducedMotion])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !reducedMotion) {
          void video.play().catch(() => undefined)
          return
        }

        video.pause()
      },
      { threshold: 0.4 },
    )

    observer.observe(video)

    return () => observer.disconnect()
  }, [activeChapter, reducedMotion])

  useEffect(() => {
    if (reducedMotion || !storyRef.current) return

    let cancelled = false
    let cleanup = () => {}

    async function setupStoryScroll() {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ])

      if (cancelled || !storyRef.current) return

      gsap.registerPlugin(ScrollTrigger)
      let current = 0

      const ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: storyRef.current,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.4,
          onUpdate: (self) => {
            const next = Math.min(videoChapters.length - 1, Math.floor(self.progress * videoChapters.length))
            if (next !== current) {
              current = next
              setActiveChapter(next)
            }
          },
        })
      }, storyRef.current)

      cleanup = () => ctx.revert()
      ScrollTrigger.refresh()
    }

    void setupStoryScroll()

    return () => {
      cancelled = true
      cleanup()
    }
  }, [reducedMotion])

  return (
    <section className={styles.videoStory} id="product-story" ref={storyRef}>
      <div className={styles.storyHeading}>
        <span className={styles.kicker}>Product tour</span>
        <h2>See your entire WhatsApp business working as one system.</h2>
        <p>Four powerful workflows. One connected platform.</p>
      </div>

      <div className={styles.storyGrid}>
        <div className={styles.chapterList}>
          {videoChapters.map((chapter, index) => (
            <button
              className={`${styles.chapterButton} ${index === activeChapter ? styles.activeChapter : ''}`}
              key={chapter.label}
              type="button"
              onClick={() => setActiveChapter(index)}
            >
              <span>{chapter.label}</span>
              <strong>{chapter.title}</strong>
              <small>{chapter.description}</small>
            </button>
          ))}
        </div>

        <div className={`${styles.videoFrame} ${active.accent === 'ai' ? styles.aiFrame : ''}`}>
          <div className={styles.videoBar}>
            <span>{active.tag}</span>
            <em>{active.label}</em>
          </div>
          <AnimatePresence mode="wait">
            <motion.video
              ref={videoRef}
              key={active.video + activeChapter}
              className={styles.storyVideo}
              src={active.video}
              muted
              autoPlay={!reducedMotion}
              loop={!reducedMotion}
              playsInline
              preload="metadata"
              controls
              aria-label={`${active.label} MetaWhat workflow video`}
              initial={{ opacity: 0, clipPath: 'inset(0 0 0 18%)' }}
              animate={{ opacity: 1, clipPath: 'inset(0 0 0 0%)' }}
              exit={{ opacity: 0, clipPath: 'inset(0 18% 0 0)' }}
              transition={{ duration: 0.32 }}
            />
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}

function FeatureBento() {
  return (
    <section className={styles.bentoSection} id="features">
      <SectionReveal className={styles.sectionHeader}>
        <span className={styles.kicker}>Workspace</span>
        <h2>One workspace. Every WhatsApp workflow.</h2>
      </SectionReveal>
      <div className={styles.bentoGrid}>
        {featureCards.map((feature) => {
          const Icon = feature.icon
          return (
            <SectionReveal
              className={`${styles.bentoCard} ${feature.size === 'large' ? styles.largeBento : ''} ${feature.accent ? styles.aiBento : ''}`}
              key={feature.title}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
              <div className={styles.cardMicroUi}>
                <span />
                <span />
                <span />
              </div>
            </SectionReveal>
          )
        })}
      </div>
    </section>
  )
}

function AutomationSection() {
  return (
    <section className={styles.automationSection} data-gsap="automation-section">
      <div className={styles.automationInner}>
        <SectionReveal className={styles.darkHeader}>
          <span className={styles.darkKicker}>Automation system</span>
          <h2>From first message to final conversion - automatically.</h2>
        </SectionReveal>
        <div className={styles.workflowLine}>
          {automationSteps.map((step, index) => (
            <SectionReveal className={styles.workflowNode} key={step}>
              <div data-gsap="workflow-node">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{step}</strong>
              </div>
            </SectionReveal>
          ))}
          <i data-gsap="workflow-packet" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}

function AIAgentSection() {
  return (
    <section className={styles.aiSection}>
      <SectionReveal className={styles.splitCopy}>
        <span className={styles.kicker}>AI WhatsApp Agent</span>
        <h2>Your smartest teammate already knows the conversation.</h2>
        <p>
          MetaWhat connects AI to conversations, contacts, CRM stages, workflows and human teams.
          It helps where it should and hands over when a real person matters.
        </p>
      </SectionReveal>
      <SectionReveal className={styles.aiPanel}>
        <div className={styles.whatsappChat}>
          <span className={styles.chatBubble}>Hi, I want pricing for a five-person support team.</span>
          <span className={`${styles.chatBubble} ${styles.replyBubble}`}>
            Sure. I can help. Are you looking for automation, inbox, or both?
          </span>
          <span className={styles.chatBubble}>Both. We also need demo booking.</span>
        </div>
        <div className={styles.intelligencePanel}>
          {[
            ['Intent', 'Interested in product'],
            ['Lead score', '87 / 100'],
            ['Suggested action', 'Book product demo'],
            ['Next automation', 'Send booking link'],
          ].map(([label, value]) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: 14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <small>{label}</small>
              <strong>{value}</strong>
            </motion.div>
          ))}
        </div>
      </SectionReveal>
    </section>
  )
}

function SharedInboxSection() {
  return (
    <section className={styles.inboxSection}>
      <SectionReveal className={styles.sectionHeader}>
        <span className={styles.kicker}>Human handoff</span>
        <h2>AI when it helps. Humans when they matter.</h2>
      </SectionReveal>
      <SectionReveal className={styles.inboxMock}>
        <aside>
          {['Ravi Kumar', 'Priya Sharma', 'Neha Jain'].map((name, index) => (
            <span className={index === 1 ? styles.activeConversation : ''} key={name}>
              <strong>{name}</strong>
              <small>{index === 1 ? 'Assigned to Sales' : 'AI handling'}</small>
            </span>
          ))}
        </aside>
        <main>
          <div className={styles.handoffTimeline}>
            <span>AI answered question</span>
            <span>Buying intent detected</span>
            <span>Assigned to Sales</span>
          </div>
          <p>Customer is evaluating MetaWhat for a support and sales team. Ask about current WhatsApp volume.</p>
        </main>
        <div className={styles.customerPanel}>
          <strong>Customer details</strong>
          <span>Tag: High intent</span>
          <span>Stage: Demo booked</span>
          <span>Owner: Priya</span>
        </div>
      </SectionReveal>
    </section>
  )
}

function AnalyticsSection() {
  const data = useMemo(
    () =>
      chartTicks.map((tick, index) => ({
        day: tick,
        read: [42, 54, 61, 70, 76, 84][index],
        replied: [12, 18, 23, 34, 40, 49][index],
      })),
    [],
  )

  return (
    <section className={styles.analyticsSection}>
      <SectionReveal className={styles.sectionHeader}>
        <span className={styles.kicker}>Real-time analytics</span>
        <h2>Know exactly what happens after you press Send.</h2>
      </SectionReveal>
      <SectionReveal className={styles.analyticsDashboard}>
        <div className={styles.analyticsStats}>
          {[
            ['Sent', '18.4K'],
            ['Delivered', '97%'],
            ['Read', '84%'],
            ['Replied', '49%'],
            ['Clicked', '28%'],
            ['Converted', '386'],
          ].map(([label, value]) => (
            <div key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid vertical={false} stroke="rgba(7,26,53,0.08)" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(7,26,53,0.08)' }} />
            <Line type="monotone" dataKey="read" stroke="#0F9488" strokeWidth={3} dot={false} />
            <Line type="monotone" dataKey="replied" stroke="#5B5CE2" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <div className={styles.insightCard}>Replies are 28% higher among leads contacted between 10 AM and 1 PM.</div>
      </SectionReveal>
    </section>
  )
}

function IntegrationsSection() {
  return (
    <section className={styles.integrationsSection} id="integrations">
      <SectionReveal className={styles.sectionHeader}>
        <span className={styles.kicker}>Integrations</span>
        <h2>Connect MetaWhat to the tools already running your business.</h2>
      </SectionReveal>
      <div className={styles.integrationNetwork}>
        <div className={styles.centerNode}>MetaWhat</div>
        {integrations.map(([name, useCase]) => (
          <SectionReveal className={styles.integrationNode} key={name}>
            <Network className="h-4 w-4" aria-hidden="true" />
            <strong>{name}</strong>
            <span>{useCase}</span>
          </SectionReveal>
        ))}
      </div>
    </section>
  )
}

function SolutionsSection() {
  return (
    <section className={styles.solutionsSection}>
      <SectionReveal className={styles.sectionHeader}>
        <span className={styles.kicker}>Solutions</span>
        <h2>Built around business outcomes, not feature noise.</h2>
      </SectionReveal>
      <div className={styles.solutionGrid}>
        {solutions.map(([title, copy]) => (
          <SectionReveal className={styles.solutionCard} key={title}>
            <h3>{title}</h3>
            <p>{copy}</p>
          </SectionReveal>
        ))}
      </div>
    </section>
  )
}

function SecuritySection() {
  return (
    <section className={styles.securitySection}>
      <SectionReveal className={styles.securityCard}>
        <div>
          <span className={styles.kicker}>Security and trust</span>
          <h2>Built for business-critical conversations.</h2>
          <p>
            Official WhatsApp Business API support, multi-tenant workspace design, team roles,
            webhook reliability, delivery tracking and secure business data handling.
          </p>
        </div>
        <div className={styles.securityFlow}>
          {['Business', 'MetaWhat', 'WhatsApp API'].map((item) => (
            <span key={item}>
              <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              {item}
            </span>
          ))}
        </div>
      </SectionReveal>
    </section>
  )
}

function Testimonials() {
  return (
    <section className={styles.testimonialSection}>
      <SectionReveal className={styles.sectionHeader}>
        <span className={styles.kicker}>Customer stories</span>
        <h2>Replaceable stories, written like real business outcomes.</h2>
      </SectionReveal>
      <div className={styles.testimonialGrid}>
        {testimonials.map((story) => (
          <SectionReveal className={styles.testimonialCard} key={story.quote}>
            <p>&quot;{story.quote}&quot;</p>
            <strong>{story.result}</strong>
            <span>{story.name}</span>
          </SectionReveal>
        ))}
      </div>
    </section>
  )
}

function PricingPreview() {
  return (
    <section className={styles.pricingSection} id="pricing">
      <SectionReveal className={styles.sectionHeader}>
        <span className={styles.kicker}>Pricing</span>
        <h2>Start simple. Scale when WhatsApp becomes a growth channel.</h2>
      </SectionReveal>
      <div className={styles.pricingGrid}>
        {[
          ['Starter', 'For teams getting live on WhatsApp'],
          ['Growth', 'For serious sales and support teams'],
          ['Scale', 'For high-volume automation'],
        ].map(([plan, copy], index) => (
          <SectionReveal className={`${styles.priceCard} ${index === 1 ? styles.recommendedPlan : ''}`} key={plan}>
            {index === 1 && <span>Recommended</span>}
            <h3>{plan}</h3>
            <p>{copy}</p>
            <Link href="/sign-up">View full pricing</Link>
          </SectionReveal>
        ))}
      </div>
    </section>
  )
}

function FAQSection() {
  const [open, setOpen] = useState(0)

  return (
    <section className={styles.faqSection} id="resources">
      <SectionReveal className={styles.sectionHeader}>
        <span className={styles.kicker}>FAQ</span>
        <h2>Common questions before you start.</h2>
      </SectionReveal>
      <div className={styles.faqList}>
        {faqs.map(([question, answer], index) => (
          <div className={styles.faqItem} key={question}>
            <button type="button" onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}>
              {question}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
              {open === index && (
                <motion.p
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {answer}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className={styles.finalCta}>
      <SectionReveal>
        <span className={styles.kicker}>Ready when you are</span>
        <h2>Your customers are already on WhatsApp. Your business should work better there.</h2>
        <p>Bring campaigns, conversations, AI, automation and analytics into one connected workspace.</p>
        <div className={styles.heroActions}>
          <Link className={styles.primaryButton} href="/sign-up">
            Start for free
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link className={styles.secondaryButton} href="/sign-in">
            Book a demo
          </Link>
        </div>
      </SectionReveal>
    </section>
  )
}

function Footer() {
  const columns = [
    ['Product', 'Campaigns', 'Inbox', 'Automation', 'AI Agent', 'Analytics', 'Integrations'],
    ['Solutions', 'Sales', 'Marketing', 'Customer Support', 'Operations'],
    ['Resources', 'Documentation', 'API', 'Blog', 'Help Centre', 'Status'],
    ['Company', 'About', 'Contact', 'Partners', 'Careers'],
  ]

  return (
    <footer className={styles.footer}>
      <div className={styles.footerBrandRow}>
        <Link className={styles.footerBrand} href="/">
          <Image src="/brand/metawhat-logo-white.png" alt="" width={120} height={42} />
        </Link>
        <p>MetaWhat is the WhatsApp Growth OS for serious business teams.</p>
      </div>
      <div className={styles.footerGrid}>
        {columns.map(([title, ...links]) => (
          <div key={title}>
            <strong>{title}</strong>
            {links.map((link) => (
              <a href="/sign-up" key={link}>{link}</a>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.footerBottom}>
        <span>© 2026 MetaWhat</span>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <a href="/privacy">Cookie Policy</a>
        </div>
      </div>
    </footer>
  )
}

export default function Home() {
  const pageRef = useRef<HTMLElement | null>(null)
  useHomepageGsap(pageRef)

  return (
    <main className={styles.page} ref={pageRef}>
      <Navbar />
      <Hero />
      <TrustSection />
      <ProductVideoStory />
      <FeatureBento />
      <AutomationSection />
      <AIAgentSection />
      <SharedInboxSection />
      <AnalyticsSection />
      <IntegrationsSection />
      <SolutionsSection />
      <SecuritySection />
      <Testimonials />
      <PricingPreview />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </main>
  )
}
