// 示例数据
const appData = {
    // 每日一句数据
    quotes: [
        {
            id: 1,
            text: "The only way to do great work is to love what you do.",
            translation: "成就伟大工作的唯一方式就是热爱你所做的事。",
            words: [
                { word: "great", meaning: "adj. 伟大的，杰出的" },
                { word: "work", meaning: "n. 工作，事业" },
                { word: "love", meaning: "v. 热爱，喜爱" }
            ]
        },
        {
            id: 2,
            text: "Believe you can and you're halfway there.",
            translation: "相信你能做到，你就已经成功了一半。",
            words: [
                { word: "believe", meaning: "v. 相信，信任" },
                { word: "halfway", meaning: "adv. 在中途，到一半" },
                { word: "there", meaning: "adv. 在那里，到那里" }
            ]
        },
        {
            id: 3,
            text: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
            translation: "成功不是终点，失败不是致命的：重要的是继续前进的勇气。",
            words: [
                { word: "success", meaning: "n. 成功" },
                { word: "final", meaning: "adj. 最终的，决定性的" },
                { word: "fatal", meaning: "adj. 致命的，灾难性的" },
                { word: "courage", meaning: "n. 勇气，胆量" }
            ]
        },
        {
            id: 4,
            text: "The future belongs to those who believe in the beauty of their dreams.",
            translation: "未来属于那些相信梦想之美的人。",
            words: [
                { word: "future", meaning: "n. 未来，将来" },
                { word: "belong", meaning: "v. 属于" },
                { word: "beauty", meaning: "n. 美丽，美好" },
                { word: "dream", meaning: "n. 梦想，愿望" }
            ]
        },
        {
            id: 5,
            text: "Don't watch the clock; do what it does. Keep going.",
            translation: "不要盯着时钟看，要像它一样行动。继续前进。",
            words: [
                { word: "watch", meaning: "v. 观看，注视" },
                { word: "clock", meaning: "n. 时钟" },
                { word: "keep going", meaning: "phrase. 继续前进" }
            ]
        },
        {
            id: 6,
            text: "Opportunities don't happen. You create them.",
            translation: "机会不会自己出现，你要去创造它们。",
            words: [
                { word: "opportunity", meaning: "n. 机会，机遇" },
                { word: "happen", meaning: "v. 发生" },
                { word: "create", meaning: "v. 创造，创建" }
            ]
        },
        {
            id: 7,
            text: "It always seems impossible until it's done.",
            translation: "在事情完成之前，它总是看起来不可能。",
            words: [
                { word: "seem", meaning: "v. 似乎，看起来" },
                { word: "impossible", meaning: "adj. 不可能的" },
                { word: "until", meaning: "prep. 直到...为止" }
            ]
        }
    ],

    // 单词卡片数据
    words: [
        {
            id: 1,
            word: "perseverance",
            phonetic: "/ˌpɜːrsɪˈvɪrəns/",
            meanings: [
                { pos: "n.", def: "毅力，坚持不懈" }
            ],
            example: {
                en: "Success requires perseverance and dedication.",
                zh: "成功需要毅力和奉献精神。"
            }
        },
        {
            id: 2,
            word: "eloquent",
            phonetic: "/ˈeləkwənt/",
            meanings: [
                { pos: "adj.", def: "雄辩的，有说服力的" },
                { pos: "adj.", def: "口才流利的" }
            ],
            example: {
                en: "She gave an eloquent speech at the conference.",
                zh: "她在会议上发表了一场雄辩的演讲。"
            }
        },
        {
            id: 3,
            word: "resilient",
            phonetic: "/rɪˈzɪliənt/",
            meanings: [
                { pos: "adj.", def: "有弹性的，能复原的" },
                { pos: "adj.", def: "适应力强的" }
            ],
            example: {
                en: "Children are often more resilient than adults.",
                zh: "孩子们往往比成年人更有适应力。"
            }
        },
        {
            id: 4,
            word: "ambiguous",
            phonetic: "/æmˈbɪɡjuəs/",
            meanings: [
                { pos: "adj.", def: "模糊的，含糊不清的" }
            ],
            example: {
                en: "The instructions were ambiguous and confusing.",
                zh: "说明模糊不清，令人困惑。"
            }
        },
        {
            id: 5,
            word: "meticulous",
            phonetic: "/məˈtɪkjələs/",
            meanings: [
                { pos: "adj.", def: "一丝不苟的，注重细节的" }
            ],
            example: {
                en: "She is meticulous in her work and never makes mistakes.",
                zh: "她工作一丝不苟，从不犯错。"
            }
        },
        {
            id: 6,
            word: "pragmatic",
            phonetic: "/præɡˈmætɪk/",
            meanings: [
                { pos: "adj.", def: "务实的，实际的" }
            ],
            example: {
                en: "We need a pragmatic approach to solve this problem.",
                zh: "我们需要用务实的方法来解决这个问题。"
            }
        },
        {
            id: 7,
            word: "nostalgia",
            phonetic: "/nɒˈstældʒə/",
            meanings: [
                { pos: "n.", def: "怀旧，乡愁" }
            ],
            example: {
                en: "The old photos filled her with nostalgia.",
                zh: "旧照片让她充满了怀旧之情。"
            }
        },
        {
            id: 8,
            word: "innovative",
            phonetic: "/ˈɪnəveɪtɪv/",
            meanings: [
                { pos: "adj.", def: "创新的，革新的" }
            ],
            example: {
                en: "The company is known for its innovative products.",
                zh: "这家公司以创新产品而闻名。"
            }
        },
        {
            id: 9,
            word: "benevolent",
            phonetic: "/bəˈnevələnt/",
            meanings: [
                { pos: "adj.", def: "仁慈的，慈善的" }
            ],
            example: {
                en: "The benevolent donor gave millions to charity.",
                zh: "这位仁慈的捐赠者向慈善机构捐赠了数百万。"
            }
        },
        {
            id: 10,
            word: "ephemeral",
            phonetic: "/ɪˈfemərəl/",
            meanings: [
                { pos: "adj.", def: "短暂的，瞬息的" }
            ],
            example: {
                en: "Social media fame is often ephemeral.",
                zh: "社交媒体上的名声往往是短暂的。"
            }
        }
    ],

    // 短文阅读数据
    articles: [
        {
            id: 1,
            title: "The Power of Habit",
            titleZh: "习惯的力量",
            content: `<p>Habits are the invisible architecture of daily life. According to researchers, about 40% of our daily actions are not actual decisions, but habits. Understanding how habits work is essential for personal growth.</p>
<p>Every habit consists of three parts: a cue, a routine, and a reward. The cue triggers your brain to initiate a behavior. The routine is the behavior itself. The reward is what your brain gets out of it.</p>
<p>By identifying the components of your habits, you can change them. Replace the routine while keeping the same cue and reward, and you can transform a bad habit into a good one.</p>`,
            translation: `<p>习惯是日常生活的无形架构。根据研究人员的说法，我们大约40%的日常行为不是实际的决定，而是习惯。理解习惯如何运作对于个人成长至关重要。</p>
<p>每个习惯都由三部分组成：提示、常规行为和奖励。提示触发你的大脑启动一种行为。常规行为是行为本身。奖励是你的大脑从中获得的东西。</p>
<p>通过识别习惯的组成部分，你可以改变它们。在保持相同提示和奖励的同时替换常规行为，你就可以将坏习惯转变为好习惯。</p>`
        },
        {
            id: 2,
            title: "Why Reading Matters",
            titleZh: "为什么阅读很重要",
            content: `<p>Reading is one of the most fundamental skills a person can learn. It opens doors to knowledge, empathy, and critical thinking. In today's digital age, the habit of reading is more important than ever.</p>
<p>Regular reading improves vocabulary, enhances focus, and reduces stress. Studies show that reading for just 30 minutes a day can significantly improve mental health and cognitive function.</p>
<p>Moreover, reading fiction increases empathy by allowing us to see the world through different perspectives. Non-fiction expands our knowledge and helps us make better decisions.</p>`,
            translation: `<p>阅读是一个人能学习的最基本技能之一。它打开了知识、同理心和批判性思维的大门。在当今数字时代，阅读的习惯比以往任何时候都更加重要。</p>
<p>定期阅读可以改善词汇量、增强专注力并减轻压力。研究表明，每天仅阅读30分钟就能显著改善心理健康和认知功能。</p>
<p>此外，阅读小说通过让我们从不同视角看世界来增强同理心。非小说类作品扩展我们的知识，帮助我们做出更好的决定。</p>`
        },
        {
            id: 3,
            title: "The Art of Learning",
            titleZh: "学习的艺术",
            content: `<p>Learning is not just about accumulating information; it's about developing the ability to think, analyze, and create. True learning happens when we connect new knowledge with what we already know.</p>
<p>Effective learners embrace challenges and view mistakes as opportunities. They ask questions, seek feedback, and practice deliberately. Most importantly, they understand that learning is a lifelong journey.</p>
<p>In a rapidly changing world, the ability to learn quickly and adapt is more valuable than any specific skill. Cultivate curiosity, stay humble, and never stop learning.</p>`,
            translation: `<p>学习不仅仅是积累信息；它是关于培养思考、分析和创造的能力。当我们把新知识与已知知识联系起来时，真正的学习就发生了。</p>
<p>有效的学习者拥抱挑战，将错误视为机会。他们提问、寻求反馈并有意练习。最重要的是，他们理解学习是一段终身旅程。</p>
<p>在快速变化的世界中，快速学习和适应的能力比任何特定技能都更有价值。培养好奇心，保持谦逊，永远不要停止学习。</p>`
        }
    ]
};
