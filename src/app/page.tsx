import Link from 'next/link'
import Image from 'next/image'
import styles from './page.module.css'
import { FileText, Clock, CheckCircle2, XCircle, Shield, Zap, RefreshCw, Quote, ArrowRight, Send } from 'lucide-react'
import { Reveal, RevealGroup, RevealItem } from './Reveal'

const particles = [
  { left: '6%', duration: 9, delay: 0 },
  { left: '16%', duration: 11, delay: 2 },
  { left: '27%', duration: 8, delay: 4 },
  { left: '41%', duration: 12, delay: 1 },
  { left: '58%', duration: 10, delay: 3 },
  { left: '69%', duration: 9, delay: 5 },
  { left: '80%', duration: 13, delay: 0.5 },
  { left: '91%', duration: 10, delay: 2.5 },
]



const features = [
  ['Automation', 'Follow-ups, payment reminders and workflows that keep moving.'],
  ['Bulk Campaigns', 'Broadcast approved WhatsApp templates to the right customers.'],
  ['Auto Replies', 'Respond faster with smart replies, routing and saved answers.'],
  ['Analytics', 'Track delivery, conversations, replies and customer activity.'],
  ['Team Inbox', 'Assign chats, add notes and keep the whole team aligned.'],
  ['Tally Sync', 'Connect customers, invoices and payment updates with Tally.'],
]

const integrations = ['Tally Prime', 'Google Sheets', 'Zapier', 'API Access', 'Webhooks']

const deepFeatures: {
  kicker: string
  title: string
  description: string
  visual: 'forms' | 'payments' | 'liveChat' | 'analytics' | 'chatbot' | 'broadcast'
}[] = [
  {
    kicker: 'Lead capture',
    title: 'Build WhatsApp Forms',
    description:
      'Capture leads and collect useful information directly inside WhatsApp chats with WhatsApp Forms. From feedback to customer insights, collect it all without leaving WhatsApp.',
    visual: 'forms',
  },
  {
    kicker: 'Payments',
    title: 'Collect Payments on WhatsApp',
    description:
      'Collect payments right inside WhatsApp with WhatsApp Pay and other modes like UPI, Razorpay and PayU, and grow your revenue without extra steps.',
    visual: 'payments',
  },
  {
    kicker: 'Team inbox',
    title: 'Multiple Human Live Chat',
    description:
      'Let multiple team members run live chat support from the same WhatsApp Business number. Filter chats by tags, campaigns and attributes for smart agent routing.',
    visual: 'liveChat',
  },
  {
    kicker: 'Analytics',
    title: 'Real-Time Analytics',
    description:
      'Track every campaign as it happens. Monitor delivered, read, replied and clicked rates in real time and retarget smartly for higher conversions.',
    visual: 'analytics',
  },
  {
    kicker: 'Chatbot',
    title: 'Build a No-Code Chatbot in Minutes',
    description:
      'Design your own chatbot flows, your way. An easy drag-and-drop chatbot and catalog flow builder for building complete conversational journeys.',
    visual: 'chatbot',
  },
  {
    kicker: 'Broadcast',
    title: 'Import & Broadcast Instantly',
    description:
      'Import your contacts and broadcast approved messages instantly. See real-time delivery and read rates right inside your metawhat dashboard.',
    visual: 'broadcast',
  },
]

function FeatureVisual({ type }: { type: (typeof deepFeatures)[number]['visual'] }) {
  if (type === 'forms') {
    return (
      <div className={styles.formsMock}>
        <div className={styles.formsMockHeader}>
          <span className={styles.formsMockAvatar}>MW</span>
          <div>
            <strong>metawhat</strong>
            <small>online</small>
          </div>
        </div>
        <div className={styles.formsMockBody}>
          <div className={`${styles.formsBubble} ${styles.formsBubbleBot} ${styles.formQ1}`}>
            Hi! Let&apos;s get you started. What&apos;s your business name?
          </div>
          <div className={`${styles.formsBubble} ${styles.formsBubbleUser} ${styles.formA1}`}>
            Sharma Traders
            <span className={styles.msgMeta}>
              10:02 <span className={styles.msgTicks}>&#10003;&#10003;</span>
            </span>
          </div>
          <div className={`${styles.formsBubble} ${styles.formsBubbleBot} ${styles.formQ2}`}>
            Great! And your work email?
          </div>
          <div className={`${styles.formsBubble} ${styles.formsBubbleUser} ${styles.formA2}`}>
            hello@sharmatraders.in
            <span className={styles.msgMeta}>
              10:03 <span className={styles.msgTicks}>&#10003;&#10003;</span>
            </span>
          </div>
          <div className={`${styles.formsSubmitted} ${styles.formSubmit}`}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Form submitted &middot; Lead captured
          </div>
          <div className={styles.formsTyping} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className={styles.formsInputBar} aria-hidden="true">
          <span>Type a message</span>
          <span className={styles.formsSendBtn}>
            <Send className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    )
  }

  if (type === 'payments') {
    return (
      <div className={styles.paymentsMock}>
        <div className={styles.paymentsCard}>
          <span className={styles.paymentsLabel}>Invoice #1042</span>
          <strong className={styles.paymentsAmount}>Rs. 18,500</strong>
          <div className={styles.paymentsButtonWrap}>
            <span className={styles.paymentsButton}>Pay Now</span>
            <span className={styles.paymentsSuccess}>
              <CheckCircle2 className="h-4 w-4" /> Payment received
            </span>
          </div>
        </div>
        <div className={styles.paymentsMethods}>
          <span>UPI</span>
          <span>Razorpay</span>
          <span>PayU</span>
        </div>
      </div>
    )
  }

  if (type === 'liveChat') {
    return (
      <div className={styles.liveChatMock}>
        <div className={styles.liveChatAgents}>
          <span className={`${styles.liveChatAvatar} ${styles.agentA}`}>R</span>
          <span className={`${styles.liveChatAvatar} ${styles.agentB}`}>P</span>
          <span className={`${styles.liveChatAvatar} ${styles.agentC}`}>N</span>
        </div>
        <div className={styles.liveChatList}>
          <div className={`${styles.liveChatRow} ${styles.rowA}`}>
            <span>Ravi Kumar</span>
            <span className={styles.liveChatTag}>Support</span>
          </div>
          <div className={`${styles.liveChatRow} ${styles.rowB}`}>
            <span>Priya Sharma</span>
            <span className={styles.liveChatTag}>Sales</span>
          </div>
          <div className={`${styles.liveChatRow} ${styles.rowC}`}>
            <span>Neha Jain</span>
            <span className={styles.liveChatTag}>VIP</span>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'analytics') {
    const campaignStats = [
      { pct: '100%', count: '17.9K', label: 'Sent', active: false },
      { pct: '97%', count: '17.3K', label: 'Delivered', active: false },
      { pct: '93%', count: '16.6K', label: 'Read', active: false },
      { pct: '45%', count: '7.3K', label: 'Clicked', active: true },
      { pct: '42%', count: '7.5K', label: 'Replied', active: false },
    ]

    return (
      <div className={styles.analyticsMock}>
        <div className={styles.anSidebar} aria-hidden="true">
          <span className={styles.anSidebarLogo}>MW</span>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className={styles.anMain}>
          <div className={styles.anHeader}>
            <span className={styles.liveDot} aria-hidden="true" />
            FESTIVAL OFFER
          </div>
          <div className={styles.anStats}>
            {campaignStats.map((stat) => (
              <div key={stat.label} className={`${styles.anStat} ${stat.active ? styles.anStatActive : ''}`}>
                <strong>{stat.pct}</strong>
                <small>({stat.count})</small>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
          <div className={styles.anMiddle}>
            <div className={styles.anMsgCard}>
              <span className={styles.anWaBadge} aria-hidden="true">WA</span>
              <strong>Hey Ravi</strong>
              <p>The Festival Offer is LIVE! Order today and win a shopping voucher worth Rs. 1,000</p>
              <em>4:31 pm &#10003;&#10003;</em>
            </div>
            <div className={styles.anCampaignCard}>
              <div className={styles.anCampaignMeta}>
                <small>Campaign name</small>
                <strong>Festival_Offer</strong>
                <small>Sent on</small>
                <strong>2 July, 2026</strong>
                <small>CTA (URL)</small>
                <strong>Shop Now</strong>
              </div>
              <svg className={styles.donut} viewBox="0 0 36 36" aria-hidden="true">
                <circle className={styles.donutTrack} cx="18" cy="18" r="15.9" pathLength="100" />
                <circle className={styles.donutValue} cx="18" cy="18" r="15.9" pathLength="100" />
                <text className={styles.donutLabel} x="18" y="18" dy="2.5">45%</text>
              </svg>
            </div>
          </div>
          <div className={styles.anChartCard}>
            <span>Audience (per day)</span>
            <svg className={styles.anChart} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
              <line className={styles.anChartGrid} x1="0" y1="10" x2="100" y2="10" />
              <line className={styles.anChartGrid} x1="0" y1="20" x2="100" y2="20" />
              <line className={styles.anChartGrid} x1="0" y1="30" x2="100" y2="30" />
              <path
                className={styles.anChartLine}
                d="M 2 34 L 16 28 L 30 30 L 44 18 L 58 22 L 72 10 L 86 14 L 98 6"
                pathLength="100"
              />
            </svg>
            <div className={styles.anChartX}>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'chatbot') {
    return (
      <div className={styles.chatbotMock}>
        <div className={styles.builderCanvas}>
          <svg className={styles.flowLines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.flowLine1} d="M 40 23 C 47 23, 46 33, 53 33" />
            <path className={styles.flowLine2} d="M 74 62 C 74 71, 60 75, 52 77" />
          </svg>
          <div className={`${styles.builderNode} ${styles.nodeStart} ${styles.bStep1}`}>
            <span className={styles.nodeTitle}>Flow Start</span>
            <span className={styles.keywordChip}>Hi</span>
            <span className={styles.keywordChip}>Hello</span>
            <span className={styles.keywordChip}>Help</span>
          </div>
          <div className={`${styles.builderNode} ${styles.nodeMedia} ${styles.bStep2}`}>
            <span className={styles.nodeTitle}>Media + Buttons</span>
            <div className={styles.nodeImage} />
            <p>Welcome to metawhat. Select an option below</p>
            <span className={styles.nodeButton}>Track Order</span>
            <span className={styles.nodeButton}>Talk to an Agent</span>
          </div>
          <div className={`${styles.builderNode} ${styles.nodeIntervene} ${styles.bStep3}`}>
            <span className={styles.nodeTitle}>Request Intervention</span>
            <p>Our team will be in touch with you soon!</p>
          </div>
        </div>
        <div className={styles.phoneFrame}>
          <div className={styles.phoneHeader}>
            <span className={styles.phoneAvatar}>MW</span>
            <div>
              <strong>metawhat</strong>
              <small>online</small>
            </div>
          </div>
          <div className={styles.phoneChat}>
            <div className={`${styles.phoneBubbleUser} ${styles.pMsg1}`}>
              Help
              <span className={styles.msgMeta}>
                4:31 pm <span className={styles.msgTicks}>&#10003;&#10003;</span>
              </span>
            </div>
            <div className={`${styles.phoneCard} ${styles.pMsg2}`}>
              <div className={styles.phoneCardImage} />
              <p>Welcome to metawhat. Select an option below</p>
              <span className={`${styles.phoneCardBtn} ${styles.pBtn1}`}>Track Order</span>
              <span className={`${styles.phoneCardBtn} ${styles.pBtn2}`}>Talk to an Agent</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const broadcastContacts = [
    'Ravi Kumar',
    'Priya Sharma',
    'Amit Verma',
    'Neha Jain',
    'Suresh Reddy',
    'Kavita Nair',
    'Manoj Verma',
  ]

  return (
    <div className={styles.broadcastMock}>
      <div className={styles.broadcastHeaderRow}>
        <span className={styles.liveDot} aria-hidden="true" />
        Broadcast: Payment reminder
        <span className={styles.broadcastSendIcon} aria-hidden="true">
          <Send className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className={styles.broadcastQueue}>
        {broadcastContacts.map((name, index) => (
          <div className={`${styles.queueRow} ${styles[`queue${index + 1}`]}`} key={name}>
            <span className={styles.queueIndex}>{index + 1}</span>
            <span className={styles.queueName}>{name}</span>
            <span className={styles.queueStatus}>Sent</span>
            <span className={styles.queueTicks}>&#10003;&#10003;</span>
          </div>
        ))}
      </div>
      <div className={styles.broadcastProgress} aria-hidden="true">
        <div className={styles.broadcastProgressFill} />
      </div>
    </div>
  )
}

const testimonials = [
  {
    initials: 'RG',
    name: 'Rohit Gupta',
    role: 'Gupta & Co.',
    quote: 'metawhat helped us manage customer communication from one place. Our response time improved within the first week.',
  },
  {
    initials: 'AM',
    name: 'Anjali Mehta',
    role: 'Mehta Finance Solutions',
    quote: 'The automation and Tally workflow feels made for finance teams. It is clean, practical and easy to recommend.',
  },
  {
    initials: 'VJ',
    name: 'Vikram Jain',
    role: 'Jain Traders',
    quote: 'We moved reminders, replies and campaigns into one system. The team finally has a clear view of every conversation.',
  },
  {
    initials: 'SR',
    name: 'Suresh Reddy',
    role: 'Reddy Textiles',
    quote: 'Payment reminders that used to take hours now go out automatically. Our outstanding collections improved within a month.',
  },
  {
    initials: 'KN',
    name: 'Kavita Nair',
    role: 'Nair Distributors',
    quote: 'Customers request their ledger balance on WhatsApp and get it instantly. It has cut our support calls in half.',
  },
  {
    initials: 'MV',
    name: 'Manoj Verma',
    role: 'Verma Enterprises',
    quote: 'Invoices sync straight from Tally to WhatsApp the moment they are raised. No more manual PDF exports.',
  },
  {
    initials: 'PI',
    name: 'Priya Iyer',
    role: 'Iyer & Associates',
    quote: 'As a CA firm managing multiple clients, the team inbox keeps every conversation organized and accountable.',
  },
]

const plans: {
  name: string
  price: string
  detail: string
  items: string[]
}[] = [
  {
    name: 'Starter',
    price: 'Rs. 999',
    detail: 'Perfect for small businesses',
    items: ['1 WhatsApp number', '1,000 messages / month', 'Basic automation', 'Email support'],
  },
  {
    name: 'Growth',
    price: 'Rs. 2,999',
    detail: 'For growing teams',
    items: ['5 WhatsApp numbers', '10,000 messages / month', 'Advanced automation', 'Chatbot and auto reply', 'Priority support'],
  },
  {
    name: 'Scale',
    price: 'Rs. 7,999',
    detail: 'For larger businesses',
    items: ['Unlimited WhatsApp numbers', 'Unlimited messages', 'Team collaboration', 'Dedicated support'],
  },
]

export default function Home() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <div className={styles.navContainer}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandMark} aria-hidden="true">
              <Image
                src="/brand/metawhat-mark.png"
                alt=""
                width={34}
                height={34}
                className={styles.brandLogo}
                priority
              />
            </span>
            <span>metawhat</span>
          </Link>
          <div className={styles.navLinks} aria-label="Primary navigation">
            <Link href="/">Home</Link>
            <Link href="#features">Solutions <span className={styles.chevron}>v</span></Link>
            <Link href="#pricing">Pricing</Link>
            <Link href="#footer">Contact Us</Link>
          </div>
          <div className={styles.navActions}>
            <Link className={styles.navDashboardButton} href="/dashboard">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroBlobs} aria-hidden="true">
          <span className={`${styles.blob} ${styles.blobOne}`} />
          <span className={`${styles.blob} ${styles.blobTwo}`} />
          <span className={`${styles.blob} ${styles.blobThree}`} />
          {particles.map((particle, index) => (
            <span
              key={index}
              className={styles.particle}
              style={{
                left: particle.left,
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`,
              }}
            />
          ))}
        </div>
        <div className={styles.heroContainer}>
          <div className={styles.heroContent}>
            <Reveal direction="up">
              <span className={styles.badge}>WhatsApp + Tally, connected for growth</span>
            </Reveal>
            <Reveal direction="up" delay={0.08}>
              <h1>
                Automate WhatsApp. Manage Business.
                <br />
                <span>Grow More.</span>
              </h1>
            </Reveal>
            <Reveal direction="up" delay={0.16}>
              <p>
                metawhat helps finance teams and businesses automate WhatsApp conversations,
                manage customer communication and sync important data with Tally from one clean platform.
              </p>
            </Reveal>
            <Reveal direction="up" delay={0.24}>
              <div className={styles.heroActions}>
                <Link className={styles.primaryButton} href="/sign-up">
                  Start Free Trial
                </Link>
                <Link className={styles.secondaryButton} href="/sign-in">
                  Book a Demo
                </Link>
              </div>
            </Reveal>
            <Reveal direction="up" delay={0.32}>
              <div className={styles.trustRow}>
                <span>No credit card required</span>
                <span>14-day free trial</span>
                <span>Cancel anytime</span>
              </div>
            </Reveal>
          </div>

          <div className={styles.productVisual} aria-label="metawhat dashboard preview">
            <div className={styles.sidebar}>
              <span className={styles.sidebarLogo}>MW</span>
              {['Dashboard', 'Conversations', 'Contacts', 'Campaigns', 'Templates', 'Analytics'].map((item) => (
                <span key={item} className={item === 'Dashboard' ? styles.activeNavItem : undefined}>
                  {item}
                </span>
              ))}
            </div>
            <div className={styles.dashboard}>
              <div className={styles.dashboardHeader}>
                <div>
                  <strong>Dashboard</strong>
                  <small>Welcome back, Satyam</small>
                </div>
                <span>This Month</span>
              </div>
              <div className={styles.metricGrid}>
                {[
                  ['24,589', 'Total Conversations'],
                  ['112,300', 'Messages Sent'],
                  ['16,735', 'Active Contacts'],
                  ['98.6%', 'Delivery Rate'],
                ].map(([value, label]) => (
                  <div className={styles.metricCard} key={label}>
                    <strong>{value}</strong>
                    <span>{label}</span>
                    <small>+21.7%</small>
                  </div>
                ))}
              </div>
              <div className={styles.dashboardPanels}>
                <div className={styles.chartCard}>
                  <span>Conversations Overview</span>
                  <div className={styles.chartBars}>
                    {[32, 44, 38, 61, 54, 70, 92].map((height) => (
                      <i key={height} style={{ height: `${height}%` }} />
                    ))}
                  </div>
                </div>
                <div className={styles.campaignCard}>
                  <span>Recent Campaigns</span>
                  {['Payment Reminder', 'New Product Launch', 'Festival Offer'].map((campaign) => (
                    <p key={campaign}>
                      <b>{campaign}</b>
                      <small>Sent</small>
                    </p>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.whatsappBubble}>WA</div>
          </div>
        </div>
      </section>

      <section className={styles.clientStrip} aria-label="Trusted businesses">
        <RevealGroup className={styles.clientStripContainer}>
          {['Sree Balaji Enterprises', 'Gupta & Co.', 'KVR Consultants', 'Jain Traders', 'Mehta Finance Solutions'].map((client) => (
            <RevealItem key={client}>
              <span>{client}</span>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <section className={styles.featuresSection} id="features">
        <div className={styles.sectionContainer}>
          <Reveal className={styles.sectionHeading}>
            <span className={styles.kicker}>Everything you need</span>
            <h2>
              Automate and scale on <span>WhatsApp</span>
            </h2>
          </Reveal>
          <RevealGroup className={styles.featureGrid}>
            {features.map(([title, copy], index) => (
              <RevealItem key={title}>
                <article className={styles.featureCard}>
                  <span className={styles.icon}>{String(index + 1).padStart(2, '0')}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className={styles.deepFeatures}>
        <div className={styles.sectionContainer}>
          {deepFeatures.map((feature, index) => (
            <div
              className={`${styles.deepFeatureRow} ${index % 2 === 1 ? styles.reverse : ''}`}
              key={feature.title}
            >
              <Reveal direction={index % 2 === 1 ? 'right' : 'left'} className={styles.deepFeatureText}>
                <span className={styles.kicker}>{feature.kicker}</span>
                <h2>{feature.title}</h2>
                <p>{feature.description}</p>
                <Link className={styles.exploreLink} href="/sign-up">
                  Explore
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Reveal>
              <Reveal direction={index % 2 === 1 ? 'left' : 'right'} className={styles.deepFeatureVisual}>
                <div className={styles.visualWindow}>
                  <div className={styles.visualChrome} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <em>metawhat &middot; {feature.kicker}</em>
                  </div>
                  <div className={styles.visualBody}>
                    <FeatureVisual type={feature.visual} />
                  </div>
                </div>
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.integrationBand} id="integrations">
        <div className={styles.integrationBandContainer}>
          <Reveal direction="left">
            <span className={styles.badgeDark}>Powerful integrations</span>
            <h2>Works seamlessly with your tools</h2>
            <p>Connect metawhat with the platforms you already use and automate communication, reminders and data flow.</p>
          </Reveal>
          <RevealGroup className={styles.integrationGrid}>
            {integrations.map((integration) => (
              <RevealItem key={integration} direction="right">
                <span>{integration}</span>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className={styles.workflowSection}>
        <div className={styles.sectionContainer}>
          <Reveal className={styles.sectionHeading}>
            <span className={styles.kicker}>How it works</span>
            <h2>
              Get started in <span>3 simple steps</span>
            </h2>
          </Reveal>
          <RevealGroup className={styles.steps}>
            {[
              ['Connect WhatsApp', 'Connect your WhatsApp number in a few clicks.'],
              ['Set up automation', 'Create templates, replies and workflows.'],
              ['Engage and grow', 'Launch campaigns and convert conversations.'],
            ].map(([title, copy], index) => (
              <RevealItem key={title}>
                <article className={styles.stepCard}>
                  <span>{index + 1}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className={styles.conversationSection}>
        <div className={styles.conversationSectionContainer}>
          <Reveal direction="left">
            <span className={styles.kicker}>Built for businesses</span>
            <h2>A better way to manage customer conversations</h2>
            <ul>
              <li>Centralized inbox for all WhatsApp conversations</li>
              <li>Quick replies, tags and notes to close conversations faster</li>
              <li>Secure, reliable and built for scale</li>
            </ul>
          </Reveal>
          <Reveal direction="right" className={styles.inboxMockup}>
            <div className={styles.inboxList}>
              <strong>Inbox</strong>
              {['Ravi Kumar', 'Priya Sharma', 'Amit Verma', 'Neha Jain'].map((name, index) => (
                <span key={name} className={index === 0 ? styles.selectedChat : undefined}>
                  {name}
                  <small>{index === 0 ? 'Please share the invoice.' : 'Message received'}</small>
                </span>
              ))}
            </div>
            <div className={styles.chatPanel}>
              <strong>Ravi Kumar</strong>
              <p>Hi, I am interested in your product.</p>
              <p className={styles.reply}>Hello Ravi. How can we help you today?</p>
              <p>Can you share the pricing details?</p>
              <p className={styles.reply}>Sure. Please find the details here.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* NEW: Tally Automated Reminders Workflow Showcase */}
      <section className={styles.showcaseSection}>
        <div className={styles.sectionContainer}>
          <Reveal className={styles.sectionHeading}>
            <span className={styles.kicker}>Tally ERP Automation</span>
            <h2>Built Specifically for <span>Tally ERP Workflows</span></h2>
            <p style={{ marginTop: '12px', color: '#526173' }}>
              No manual uploads. metawhat connects directly with your Tally ERP database to automate major business communications in real time.
            </p>
          </Reveal>
          <RevealGroup className={styles.showcaseGrid}>
            <RevealItem>
              <article className={styles.showcaseCard}>
                <div className={styles.showcaseIcon}>
                  <FileText className="h-6 w-6" />
                </div>
                <h3>Sales Invoices</h3>
                <p>Send clean PDF invoices on WhatsApp as soon as they are made in Tally. Fast, official, and direct.</p>
              </article>
            </RevealItem>
            <RevealItem>
              <article className={styles.showcaseCard}>
                <div className={styles.showcaseIcon}>
                  <Clock className="h-6 w-6" />
                </div>
                <h3>Outstanding Reminders</h3>
                <p>Automatically schedule friendly payment alerts for ledgers with outstanding balances to reduce delay times.</p>
              </article>
            </RevealItem>
            <RevealItem>
              <article className={styles.showcaseCard}>
                <div className={styles.showcaseIcon}>
                  <Shield className="h-6 w-6" />
                </div>
                <h3>Ledger Statements</h3>
                <p>Let clients request their balance and ledger statements by typing a keyword on WhatsApp.</p>
              </article>
            </RevealItem>
            <RevealItem>
              <article className={styles.showcaseCard}>
                <div className={styles.showcaseIcon}>
                  <Zap className="h-6 w-6" />
                </div>
                <h3>Payment Receipts</h3>
                <p>Instantly confirm transactions by auto-sending WhatsApp payment receipts as soon as vouchers are recorded.</p>
              </article>
            </RevealItem>
          </RevealGroup>
        </div>
      </section>

      {/* NEW: Manual vs metawhat Comparison Section */}
      <section className={styles.comparisonSection}>
        <div className={styles.sectionContainer}>
          <Reveal className={styles.sectionHeading}>
            <span className={styles.kicker}>Why metawhat?</span>
            <h2>Automate the <span>Heavy Lifting</span></h2>
          </Reveal>
          <RevealGroup className={styles.comparisonGrid}>
            <RevealItem direction="left" className={`${styles.comparisonCol} ${styles.manual}`}>
              <h3>Manual WhatsApp Reminders</h3>
              <ul className={styles.comparisonList}>
                <li className={styles.comparisonItem}>
                  <XCircle className="h-5 w-5 text-red-500" style={{ color: '#ef4444' }} />
                  <span>Manually export PDF files and invoice sheets from Tally one-by-one.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <XCircle className="h-5 w-5 text-red-500" style={{ color: '#ef4444' }} />
                  <span>Save client phone numbers on a physical mobile phone list to message them.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <XCircle className="h-5 w-5 text-red-500" style={{ color: '#ef4444' }} />
                  <span>Type out templates manually, upload attachments, and click send.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <XCircle className="h-5 w-5 text-red-500" style={{ color: '#ef4444' }} />
                  <span>Takes 5 to 10 minutes per reminder. Impossible to scale.</span>
                </li>
              </ul>
            </RevealItem>
            <RevealItem direction="right" className={`${styles.comparisonCol} ${styles.automated}`}>
              <h3>metawhat Automation</h3>
              <ul className={styles.comparisonList}>
                <li className={styles.comparisonItem}>
                  <CheckCircle2 className="h-5 w-5 text-green-500" style={{ color: '#22c55e' }} />
                  <span>Automated background connector pulls invoices from Tally instantly.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <CheckCircle2 className="h-5 w-5 text-green-500" style={{ color: '#22c55e' }} />
                  <span>Send messages directly using Meta API without saving any numbers to a phone.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <CheckCircle2 className="h-5 w-5 text-green-500" style={{ color: '#22c55e' }} />
                  <span>Pre-approved official templates are sent with a single click or automatically.</span>
                </li>
                <li className={styles.comparisonItem}>
                  <CheckCircle2 className="h-5 w-5 text-green-500" style={{ color: '#22c55e' }} />
                  <span>Takes less than 5 seconds. Send thousands of reminders at once.</span>
                </li>
              </ul>
            </RevealItem>
          </RevealGroup>
        </div>
      </section>

      <section className={styles.testimonials}>
        <Reveal className={styles.testimonialsIntro}>
          <span className={styles.kicker}>What our clients say</span>
          <h2>Loved by businesses, trusted for results</h2>
          <p className={styles.testimonialsHint}>
            From CA firms to traders, hear what businesses say after switching to metawhat. Hover a card to read their story.
          </p>
        </Reveal>
        <div className={styles.marqueeViewport}>
          <div className={styles.marqueeTrack}>
            {[...testimonials, ...testimonials].map((testimonial, index) => (
              <div
                className={styles.flipCard}
                key={`${testimonial.name}-${index}`}
                aria-hidden={index >= testimonials.length}
              >
                <div className={styles.flipCardInner}>
                  <div className={`${styles.flipFace} ${styles.flipFront}`}>
                    <span className={styles.flipIcon} aria-hidden="true">
                      <RefreshCw className="h-4 w-4" />
                    </span>
                    <span className={styles.flipInitials} aria-hidden="true">
                      {testimonial.initials}
                    </span>
                    <div>
                      <strong>{testimonial.name}</strong>
                      <small>Verified customer</small>
                      <span className={styles.reviewBadge}>5/5 review</span>
                    </div>
                  </div>
                  <div className={`${styles.flipFace} ${styles.flipBack}`}>
                    <Quote className={styles.flipQuoteMark} aria-hidden="true" />
                    <p className={styles.flipQuoteText}>{testimonial.quote}</p>
                    <div>
                      <strong>{testimonial.name}</strong>
                      <small>{testimonial.role}</small>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NEW: FAQ Section */}
      <section className={styles.faqSection}>
        <div className={styles.sectionContainer}>
          <Reveal className={styles.sectionHeading}>
            <span className={styles.kicker}>Frequently Asked Questions</span>
            <h2>Got Questions? <span>We Have Answers</span></h2>
          </Reveal>
          <RevealGroup className={styles.faqGrid}>
            <RevealItem>
              <div className={styles.faqCard}>
                <h3>How does the Tally integration work?</h3>
                <p>We provide a secure, lightweight connector that runs alongside your Tally ERP installation. It reads ledger balances and invoice details and pushes them securely to metawhat to trigger updates.</p>
              </div>
            </RevealItem>
            <RevealItem>
              <div className={styles.faqCard}>
                <h3>Do I need a WhatsApp Business API account?</h3>
                <p>Yes. metawhat uses the official Meta Cloud API to ensure delivery rates and prevent number bans. We provide embedded onboarding inside our app to help you set it up in under 5 minutes.</p>
              </div>
            </RevealItem>
            <RevealItem>
              <div className={styles.faqCard}>
                <h3>Can I use my existing WhatsApp phone number?</h3>
                <p>Yes, you can register your current number. However, you must first disconnect it from normal mobile/web WhatsApp apps so it can connect to the Cloud API.</p>
              </div>
            </RevealItem>
            <RevealItem>
              <div className={styles.faqCard}>
                <h3>Is my financial data safe and secure?</h3>
                <p>Data security is our top priority. We only sync data points that are necessary for generating templates and reminders. All information is encrypted in transit and at rest.</p>
              </div>
            </RevealItem>
          </RevealGroup>
        </div>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <div className={styles.sectionContainer}>
          <Reveal className={styles.sectionHeading}>
            <span className={styles.kicker}>Simple pricing</span>
            <h2>Choose the plan that fits your business</h2>
          </Reveal>
          <RevealGroup className={styles.pricingGrid}>
            {plans.map((plan, index) => (
              <RevealItem key={plan.name}>
                <article className={`${styles.planCard} ${index === 1 ? styles.popularPlan : ''}`}>
                  {index === 1 && <span className={styles.popularBadge}>Most Popular</span>}
                  <h3>{plan.name}</h3>
                  <strong>
                    {plan.price}
                    <small>/month</small>
                  </strong>
                  <p>{plan.detail}</p>
                  <ul>
                    {plan.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <Link className={styles.primaryButton} href="/sign-up">
                    Start Free Trial
                  </Link>
                </article>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <Reveal className={styles.ctaSectionContainer}>
          <div className={styles.ctaIcon}>WA</div>
          <div>
            <h2>Ready to automate your business with WhatsApp and Tally?</h2>
            <p>Start your 14-day free trial today. No credit card required.</p>
          </div>
          <Link className={styles.secondaryButton} href="/sign-up">
            Start Free Trial
          </Link>
        </Reveal>
      </section>

      <footer className={styles.footer} id="footer">
        <div className={styles.footerContainer}>
          <div>
            <Link className={styles.footerBrand} href="/">
              <span className={styles.brandMark} aria-hidden="true">
                <Image
                  src="/brand/metawhat-mark.png"
                  alt=""
                  width={30}
                  height={30}
                  className={styles.brandLogo}
                />
              </span>
              <span>metawhat</span>
            </Link>
            <p>Automate WhatsApp. Manage business. Integrate with Tally. Grow more.</p>
          </div>
          <div>
            <strong>Product</strong>
            <Link href="#features">Features</Link>
            <Link href="#integrations">Integrations</Link>
            <Link href="#pricing">Pricing</Link>
          </div>
          <div>
            <strong>Company</strong>
            <Link href="/sign-in">Login</Link>
            <Link href="/sign-up">Start Free Trial</Link>
            <Link href="#footer">Contact Us</Link>
          </div>
          <div>
            <strong>Legal</strong>
            <Link href="#footer">Privacy Policy</Link>
            <Link href="#footer">Terms of Service</Link>
            <Link href="#footer">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
