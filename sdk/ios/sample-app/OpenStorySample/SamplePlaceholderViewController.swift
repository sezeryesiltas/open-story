import UIKit

final class SamplePlaceholderViewController: UIViewController {
    private let titleText: String
    private let subtitleText: String
    private let symbolName: String

    init(
        titleText: String,
        subtitleText: String,
        symbolName: String
    ) {
        self.titleText = titleText
        self.subtitleText = subtitleText
        self.symbolName = symbolName
        super.init(nibName: nil, bundle: nil)
        title = titleText
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = Theme.background

        let heroCard = UIView()
        heroCard.translatesAutoresizingMaskIntoConstraints = false
        heroCard.backgroundColor = Theme.heroSolidBackground
        heroCard.layer.cornerRadius = 28
        heroCard.layer.masksToBounds = true

        let iconView = UIImageView(image: UIImage(systemName: symbolName))
        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconView.tintColor = Theme.heroIconTint
        iconView.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: 42, weight: .bold)

        let titleLabel = UILabel()
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.font = .systemFont(ofSize: 28, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.text = titleText

        let subtitleLabel = UILabel()
        subtitleLabel.translatesAutoresizingMaskIntoConstraints = false
        subtitleLabel.font = .systemFont(ofSize: 16, weight: .medium)
        subtitleLabel.textColor = Theme.heroSubtitle
        subtitleLabel.numberOfLines = 0
        subtitleLabel.text = subtitleText

        let stack = UIStackView(arrangedSubviews: [iconView, titleLabel, subtitleLabel])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 18
        stack.alignment = .leading

        heroCard.addSubview(stack)
        view.addSubview(heroCard)

        NSLayoutConstraint.activate([
            heroCard.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 20),
            heroCard.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            heroCard.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),

            stack.topAnchor.constraint(equalTo: heroCard.topAnchor, constant: 28),
            stack.leadingAnchor.constraint(equalTo: heroCard.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: heroCard.trailingAnchor, constant: -24),
            stack.bottomAnchor.constraint(equalTo: heroCard.bottomAnchor, constant: -28),
        ])
    }
}
